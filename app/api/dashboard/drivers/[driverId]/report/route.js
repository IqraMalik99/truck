import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectDB } from "../../../../../lib/db";
import { DriverDailyLog, Driver } from "../../../../../models/schema";

// ---------------------------------------------------------------------------
// Timezone
//
// MongoDB always stores Date fields internally as UTC — there is no
// timezone attached to the stored value itself. "What day is it" only means
// something once you pick a timezone to interpret that UTC instant in.
//
// The US observes daylight saving time, so a fixed hour offset (fine for a
// no-DST zone like Pakistan) would drift by an hour for half the year. We
// use Intl.DateTimeFormat against a real IANA zone name instead, which
// tracks DST transitions automatically.
//
// Set this to match your client's timezone. If drivers span multiple US
// timezones, a single app-wide zone won't be correct for all of them — say
// so and we can key the boundary off each driver's own timezone field
// instead.
// ---------------------------------------------------------------------------
const APP_TIMEZONE = "America/New_York"; // e.g. "America/Chicago", "America/Denver", "America/Los_Angeles"

/**
 * Returns { year, month (1-indexed), day } for "now" as seen in APP_TIMEZONE.
 */
function nowPartsInAppTimezone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((p) => p.type === "year").value),
    month: Number(parts.find((p) => p.type === "month").value),
    day: Number(parts.find((p) => p.type === "day").value),
  };
}

/**
 * Given a Y/M/D (as seen in APP_TIMEZONE), returns the UTC Date instance
 * that is midnight local time on that date. A fixed offset would break
 * across the DST transition, so this asks "what UTC instant reads as
 * exactly Y-M-D 00:00 in APP_TIMEZONE?" via a short converging correction.
 * This is the value that should be stored in / compared against a Mongo
 * `Date` field representing a calendar day.
 */
function localMidnightUTC(year, month, day) {
  let guess = Date.UTC(year, month - 1, day);

  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(guess));

    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const seenAsUTC = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
      get("second")
    );

    const targetAsUTC = Date.UTC(year, month - 1, day, 0, 0, 0);
    guess += targetAsUTC - seenAsUTC;
  }

  return new Date(guess);
}

/**
 * The [start, end) UTC range — suitable for a Mongo `$gte`/`$lt` query
 * against a Date field — for a given calendar date in APP_TIMEZONE.
 * `dateStr` is "YYYY-MM-DD" as picked by the client (e.g. a date input);
 * omit it to mean "today" in APP_TIMEZONE.
 */
function dayRange(dateStr) {
  let year, month, day;

  if (dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    year = y;
    month = m;
    day = d;
  } else {
    ({ year, month, day } = nowPartsInAppTimezone());
  }

  const start = localMidnightUTC(year, month, day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

const COLORS = {
  ink: "#111827",
  subtext: "#6B7280",
  body: "#374151",
  border: "#E5E7EB",
  cardBg: "#F9FAFB",
  rowAlt: "#F8FAFC",
  accent: "#2563EB",
  success: "#22C55E",
  divider: "#E2E8F0",
};

const STATUS_META = {
  off_duty: { label: "Off Duty", color: "#94A3B8" },
  sleeper_berth: { label: "Sleeper Berth", color: "#8B5CF6" },
  driving: { label: "Driving", color: "#DC2626" },
  on_duty: { label: "On Duty (Not Driving)", color: "#22C55E" },
};

const PAGE_MARGIN = 50;

function minutesBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 1440;
  return diff;
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
}

function sectionHeading(doc, text) {
  ensureSpace(doc, 40);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.ink).text(text);
  const lineY = doc.y + 4;
  doc
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .lineWidth(1)
    .strokeColor(COLORS.divider)
    .stroke();
  doc.moveDown(0.9);
}

function drawHeader(doc, { dateLabel, driver }) {
  const startX = doc.page.margins.left;
  const iconCx = startX + 10;
  const iconCy = doc.y + 12;

  doc.circle(iconCx, iconCy, 10).fill(COLORS.success);
  doc
    .save()
    .strokeColor("white")
    .lineWidth(2)
    .moveTo(iconCx - 5, iconCy)
    .lineTo(iconCx - 1, iconCy + 4)
    .lineTo(iconCx + 5, iconCy - 5)
    .stroke()
    .restore();

  doc
    .fillColor(COLORS.ink)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("Daily Driver Log Report", iconCx + 20, doc.y - 4);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(COLORS.subtext)
    .text("Log closed — totals below are final", iconCx + 20, doc.y + 2);

  doc.moveDown(1.4);

  const metaY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text(dateLabel, startX, metaY);

  const rightText = [driver?.name, driver?.carrierName].filter(Boolean).join("  ·  ");
  if (rightText) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.subtext)
      .text(rightText, startX, metaY + 1, {
        width: doc.page.width - doc.page.margins.right - startX,
        align: "right",
      });
  }
  doc.moveDown(1.2);
}

function drawHeroStats(doc, stats) {
  const startX = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bandHeight = 74;
  const y = doc.y;

  doc.roundedRect(startX, y, width, bandHeight, 8).fill(COLORS.ink);

  const colWidth = width / stats.length;
  stats.forEach((s, i) => {
    const x = startX + i * colWidth;
    if (i > 0) {
      doc
        .moveTo(x, y + 14)
        .lineTo(x, y + bandHeight - 14)
        .strokeColor("#374151")
        .lineWidth(1)
        .stroke();
    }
    doc
      .fillColor(s.accent || "white")
      .font("Helvetica-Bold")
      .fontSize(26)
      .text(s.value, x, y + 14, { width: colWidth, align: "center" });
    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(9)
      .text(s.label.toUpperCase(), x, y + 48, {
        width: colWidth,
        align: "center",
        characterSpacing: 0.5,
      });
  });

  doc.y = y + bandHeight + 20;
}

function drawSummaryCards(doc, cardData, cols = 4) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const colWidth = (pageWidth - gap * (cols - 1)) / cols;
  const rowHeight = 52;
  const startX = doc.page.margins.left;
  const startY = doc.y;

  cardData.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (colWidth + gap);
    const y = startY + row * (rowHeight + gap);

    doc.roundedRect(x, y, colWidth, rowHeight, 6).fillAndStroke(COLORS.cardBg, COLORS.border);
    doc
      .fillColor(COLORS.subtext)
      .fontSize(8)
      .font("Helvetica")
      .text(label.toUpperCase(), x + 12, y + 10, { width: colWidth - 24, characterSpacing: 0.3 });
    doc
      .fillColor(COLORS.ink)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(value, x + 12, y + 24, { width: colWidth - 24 });
  });

  const rows = Math.ceil(cardData.length / cols);
  doc.y = startY + rows * (rowHeight + gap) - gap + 18;
}

function drawTripsTable(doc, trips) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: "route", label: "Route", width: 0.34 },
    { key: "odo", label: "Odometer", width: 0.18 },
    { key: "miles", label: "Miles", width: 0.12 },
    { key: "fuel", label: "Fuel", width: 0.12 },
    { key: "equip", label: "Equipment", width: 0.24 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

  const headerHeight = 22;
  const rowPadding = 8;

  function drawTableHeader(y) {
    doc.rect(startX, y, tableWidth, headerHeight).fill(COLORS.ink);
    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text(c.label.toUpperCase(), x + 8, y + 7, { width: c.width - 12 });
      x += c.width;
    });
    return y + headerHeight;
  }

  ensureSpace(doc, headerHeight + 30);
  let y = drawTableHeader(doc.y);

  if (trips.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#9CA3AF")
      .text("No trips logged this day.", startX + 8, y + rowPadding, { width: tableWidth - 16 });
    doc.y = y + rowPadding + 20;
    return;
  }

  trips.forEach((t, i) => {
    const route = `${t.startLocation?.formatted || "?"} to ${t.endLocation?.formatted || "In progress"}`;
    const odo = `${t.odometerBeginning ?? "—"}${t.odometerEnding ? ` – ${t.odometerEnding}` : ""}`;
    const miles = t.totalMiles ? `${t.totalMiles} mi` : "—";
    const fuel = t.fuel ? `${t.fuel} gal` : "—";
    const equip =
      [
        t.truck?.unitNumber ? `Unit ${t.truck.unitNumber}` : null,
        t.trailer?.trailerNumber ? `Trailer ${t.trailer.trailerNumber}` : null,
      ]
        .filter(Boolean)
        .join(" / ") || "—";

    const cellValues = { route, odo, miles, fuel, equip };

    const routeHeight = doc.heightOfString(route, { width: columns[0].width - 16, fontSize: 9 });
    const rowHeight = Math.max(24, routeHeight + rowPadding * 2 - 6);

    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight + headerHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) {
      y = drawTableHeader(doc.y);
    }

    if (i % 2 === 1) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.rowAlt);
    }

    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor(c.key === "route" ? COLORS.ink : COLORS.body)
        .font(c.key === "route" ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .text(cellValues[c.key], x + 8, y + rowPadding - 4, { width: c.width - 12 });
      x += c.width;
    });

    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;
  });

  doc.y = y + 16;
}

function drawPieSlice(doc, cx, cy, radius, startAngle, endAngle, color) {
  const steps = Math.max(2, Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * 120));
  const points = [[cx, cy]];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / steps;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc.polygon(...points).fill(color);
}

function drawDutyPieChart(doc, x, y, radius, hoursByStatus) {
  const entries = Object.entries(hoursByStatus).filter(([, mins]) => mins > 0);
  const total = entries.reduce((sum, [, mins]) => sum + mins, 0);

  if (total === 0) {
    doc
      .fontSize(10)
      .fillColor(COLORS.subtext)
      .text("No duty status logged this day.", x - radius, y, { width: radius * 2, align: "center" });
    return radius * 2 + 20;
  }

  const cx = x;
  const cy = y + radius;
  let angle = -Math.PI / 2;

  entries.forEach(([status, mins]) => {
    const slice = (mins / total) * Math.PI * 2;
    drawPieSlice(doc, cx, cy, radius, angle, angle + slice, STATUS_META[status]?.color || "#CBD5E1");
    angle += slice;
  });

  doc.circle(cx, cy, radius * 0.45).fill("white");
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(fmtHours(total), cx - radius * 0.4, cy - 6, { width: radius * 0.8, align: "center" });

  const legendX = x + radius + 30;
  let legendY = y + 6;
  entries.forEach(([status, mins]) => {
    const meta = STATUS_META[status] || { label: status, color: "#CBD5E1" };
    const pct = Math.round((mins / total) * 100);
    doc.roundedRect(legendX, legendY, 10, 10, 2).fill(meta.color);
    doc
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(meta.label, legendX + 16, legendY - 1, { continued: false });
    doc
      .fillColor(COLORS.subtext)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`${fmtHours(mins)} · ${pct}%`, legendX + 16, legendY + 11);
    legendY += 30;
  });

  return Math.max(radius * 2, legendY - y) + 20;
}

function drawFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 30;
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .moveTo(doc.page.margins.left, bottom - 10)
      .lineTo(doc.page.width - doc.page.margins.right, bottom - 10)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.subtext)
      .text(
       `Report`,
        doc.page.margins.left,
        bottom,
        { width: 250, align: "left", lineBreak: false }
      );
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.subtext)
      .text(
        `Page ${i - range.start + 1} of ${range.count}`,
        doc.page.width - doc.page.margins.right - 150,
        bottom,
        { width: 150, align: "right", lineBreak: false }
      );

    doc.page.margins.bottom = originalBottomMargin;
  }
}

export async function GET(request, { params }) {
  try {
    return await handleGet(request, params);
  } catch (err) {
    console.error("[daily-report:byDriver] Unhandled error while generating report:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

async function handleGet(request, paramsPromise) {
  console.log("[daily-report:byDriver] GET called");

  await connectDB();
  console.log("[daily-report:byDriver] DB connected");

  const { driverId } = await paramsPromise;
  if (!driverId) {
    console.warn("[daily-report:byDriver] Missing driverId in route params");
    return NextResponse.json({ error: "Missing driverId" }, { status: 400 });
  }
  console.log("[daily-report:byDriver] driverId:", driverId);

  const driver = await Driver.findById(driverId);
  if (!driver) {
    console.warn("[daily-report:byDriver] No Driver found for id:", driverId);
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }
  console.log("[daily-report:byDriver] Driver resolved:", {
    id: driver._id?.toString(),
    name: driver.name,
  });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date"); // YYYY-MM-DD, optional
  console.log("[daily-report:byDriver] date query param:", dateParam || "(none — defaulting to today)");

  // Mongo stores Date fields as UTC instants with no timezone attached;
  // "today" (or the requested date) is interpreted in APP_TIMEZONE and
  // converted to the matching UTC boundaries below.
  const { start, end } = dayRange(dateParam);
  console.log(`[daily-report:byDriver] Query window (APP_TIMEZONE = ${APP_TIMEZONE}):`, {
    start: start.toISOString(),
    end: end.toISOString(),
  });

  const dailyLog = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  }).populate({
    path: "trips",
    options: { sort: { startdate: 1 } },
    populate: [{ path: "truck" }, { path: "trailer" }],
  });

  if (!dailyLog) {
    console.warn("[daily-report:byDriver] No DriverDailyLog matched the query window", {
      driverId: driver._id?.toString(),
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
    });

    // Extra diagnostic: show the driver's most recent log so the logs make
    // it obvious whether this is a timezone/window mismatch or the driver
    // genuinely has no log for that day.
    const mostRecent = await DriverDailyLog.findOne({ driver: driver._id }).sort({ date: -1 });
    if (mostRecent) {
      console.warn("[daily-report:byDriver] Driver's most recent log for comparison:", {
        date: mostRecent.date?.toISOString(),
        dayEnded: mostRecent.dayEnded,
      });
    } else {
      console.warn("[daily-report:byDriver] Driver has no DriverDailyLog documents at all");
    }

    return NextResponse.json({ error: "No log for that day" }, { status: 404 });
  }

  console.log("[daily-report:byDriver] Log found:", {
    logId: dailyLog._id?.toString(),
    date: dailyLog.date?.toISOString(),
    dayEnded: dailyLog.dayEnded,
    tripCount: dailyLog.trips?.length ?? 0,
  });

  if (!dailyLog.dayEnded) {
    console.warn("[daily-report:byDriver] Log found but day has not been closed out — refusing to generate report", {
      logId: dailyLog._id?.toString(),
    });
    return NextResponse.json({ error: "That day hasn't been closed out yet" }, { status: 400 });
  }

  const trips = dailyLog.trips || [];

  const totalMiles = trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
  const totalFuel = trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
  const startOdometer = trips[0]?.odometerBeginning ?? null;
  const endOdometer = [...trips].reverse().find((t) => t.odometerEnding != null)?.odometerEnding ?? null;

  const allStateNames = trips.flatMap((t) => (t.states || []).map((s) => s.location?.formatted).filter(Boolean));
  const uniqueStates = [...new Set(allStateNames)];

  const hoursByStatus = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };
  (dailyLog.statusChanges || []).forEach((s) => {
    if (hoursByStatus[s.status] !== undefined) {
      hoursByStatus[s.status] += minutesBetween(s.from, s.to);
    } else {
      console.warn("[daily-report:byDriver] Unrecognized status on statusChanges entry, skipped:", s.status);
    }
  });

  console.log("[daily-report:byDriver] Computed totals:", {
    totalMiles,
    totalFuel,
    startOdometer,
    endOdometer,
    uniqueStateCount: uniqueStates.length,
    hoursByStatus,
  });

  const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfReady = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const dateLabel = new Date(dailyLog.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });

  drawHeader(doc, { dateLabel, driver });

  drawHeroStats(doc, [
    { label: "Total Miles", value: totalMiles.toLocaleString() },
    { label: "Driving Time", value: fmtHours(hoursByStatus.driving), accent: "#FCA5A5" },
    { label: "Total Fuel", value: `${totalFuel} gal` },
  ]);

  sectionHeading(doc, "Duty Status Breakdown");
  const chartRadius = 55;
  ensureSpace(doc, chartRadius * 2 + 40);
  const chartX = doc.page.margins.left + chartRadius;
  const chartStartY = doc.y;
  const chartHeight = drawDutyPieChart(doc, chartX, chartStartY, chartRadius, hoursByStatus);
  doc.y = chartStartY + chartHeight + 20;

  const cardData = [
    ["Starting Odometer", startOdometer != null ? startOdometer.toLocaleString() : "—"],
    ["Ending Odometer", endOdometer != null ? endOdometer.toLocaleString() : "—"],
    ["Trips Logged", String(trips.length)],
    ["States Covered", String(uniqueStates.length)],
  ];
  drawSummaryCards(doc, cardData);

  if (uniqueStates.length > 0) {
    sectionHeading(doc, "States Covered");
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.body).text(uniqueStates.join(", "));
    doc.moveDown(1);
  }

  sectionHeading(doc, "Trips");
  drawTripsTable(doc, trips);

  drawFooters(doc);

  doc.end();
  const pdfBuffer = await pdfReady;

  console.log("[daily-report:byDriver] PDF generated successfully:", {
    bytes: pdfBuffer.length,
    logId: dailyLog._id?.toString(),
  });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${driver.name || "driver"}-daily-log-${new Date(
        dailyLog.date
      )
        .toISOString()
        .slice(0, 10)}.pdf"`,
    },
  });
}