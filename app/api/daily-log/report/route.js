import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";

// npm install pdfkit
// (pure-JS PDF generation — runs in the same Node process as your other
// Next.js API routes, no Python/reportlab involved)

// ---------------------------------------------------------------------------
// Design tokens — keep every color/spacing decision in one place so the
// report reads as a single coherent document instead of a stack of
// independently-styled blocks. Rebranded to match the dashboard's red
// theme (#DC2626 family) instead of the previous unrelated blue accent,
// so the PDF feels like part of the same product as the app.
// ---------------------------------------------------------------------------
const COLORS = {
  ink: "#111827",
  subtext: "#6B7280",
  body: "#374151",
  border: "#E5E7EB",
  cardBg: "#F9FAFB",
  rowAlt: "#FEF2F2",
  accent: "#DC2626",
  accentDark: "#7F1D1D",
  accentSoft: "#FCA5A5",
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

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

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

// IMPORTANT: trip.fuel is maintained by the backend (/api/trips/:id/states
// and /api/trips/:id/end) as the RUNNING SUM of every one of that trip's
// states[].fuel entries — each state's fuel is set once when that state is
// closed out, either by a state-crossing or by End Trip closing the final
// state. So trip.fuel already *is* the trip's total fuel.
//
// The previous version of this report added t.fuel AND the sum of
// states[].fuel together, which double-counted every gallon. The fix is
// just to trust trip.fuel as the single source of truth per trip.
function totalFuelForTrip(t) {
  return t.fuel || 0;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

// Ensures we never draw a section header at the very bottom of a page with
// nothing under it. Call before starting any new section.
function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
}

function sectionHeading(doc, text) {
  ensureSpace(doc, 40);
  // Small accent tick to the left of every heading — a quiet, repeated
  // brand cue instead of a plain black label.
  const tickX = doc.page.margins.left;
  const tickY = doc.y + 2;
  doc.roundedRect(tickX, tickY, 4, 13, 2).fill(COLORS.accent);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.ink)
    .text(text, tickX + 12, doc.y);

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

  doc.circle(iconCx, iconCy, 10).fill(COLORS.accentDark);
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

  // Meta strip: date on the left, driver/carrier on the right, aligned on
  // one baseline instead of stacked lines competing for attention.
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

// The three numbers a driver actually needs at a glance — placed in a
// single bold band directly under the header so they're the very first
// thing the eye lands on, ahead of any secondary detail or table.
function drawHeroStats(doc, stats) {
  const startX = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bandHeight = 74;
  const y = doc.y;

  doc.roundedRect(startX, y, width, bandHeight, 8).fill(COLORS.ink);
  // Thin accent bar along the top of the band — ties the hero stats to the
  // rest of the brand palette without competing with the white numerals.
  doc.roundedRect(startX, y, width, 4, 2).fill(COLORS.accent);

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
      .text(s.value, x, y + 16, { width: colWidth, align: "center" });
    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(9)
      .text(s.label.toUpperCase(), x, y + 50, {
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
    // Small left accent edge on each card instead of a flat uniform border.
    doc.roundedRect(x, y, 3, rowHeight, 1.5).fill(COLORS.accent);
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

// Real table with a header row, alternating row shading and column rules,
// instead of freeform paragraphs — much easier to scan and it won't
// visually collide with the next section.
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
    doc.rect(startX, y, tableWidth, headerHeight).fill(COLORS.accentDark);
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
    // trip.fuel is already the rollup of every state this trip touched —
    // see totalFuelForTrip() above. Do not add per-state fuel again here.
    const tripFuel = totalFuelForTrip(t);
    const fuel = tripFuel ? `${tripFuel} gal` : "—";
    const equip = [
      t.truck?.unitNumber ? `Unit ${t.truck.unitNumber}` : null,
      t.trailer?.trailerNumber ? `Trailer ${t.trailer.trailerNumber}` : null,
    ]
      .filter(Boolean)
      .join(" / ") || "—";

    const cellValues = { route, odo, miles, fuel, equip };

    // Measure the tallest cell (route can wrap) before drawing the row so
    // the alternating background and divider lines line up exactly.
    const routeHeight = doc.heightOfString(route, { width: columns[0].width - 16, fontSize: 9 });
    const rowHeight = Math.max(24, routeHeight + rowPadding * 2 - 6);

    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight + headerHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) {
      // We moved to a new page — redraw the header there for context.
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

// Grouped by trip: each trip gets its own sub-heading and mini table —
// one row per state it covered, with that state's mileage and fuel — then
// a bolded "Trip Total" row. After every trip has its own block, a final
// "All Trips" total row closes out the section. This mirrors how a driver
// actually thinks about the day: trip by trip, state by state within it.
//
// Fuel note: each states[] entry's `fuel` is set once when that state is
// closed — either by the next state-crossing, or by End Trip closing the
// final open state. That means summing states[].fuel already gives the
// trip's full fuel total; there is no separate "end of trip" fuel bucket
// to add on top anymore (the previous version double-counted this).
function drawFuelByStateSection(doc, trips) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: "state", label: "State / Location", width: 0.46 },
    { key: "miles", label: "Mileage", width: 0.27 },
    { key: "fuel", label: "Fuel", width: 0.27 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

  const headerHeight = 20;
  const rowHeight = 20;
  const rowPadding = 6;

  function drawTableHeader(y) {
    doc.rect(startX, y, tableWidth, headerHeight).fill(COLORS.accentDark);
    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(c.label.toUpperCase(), x + 8, y + 6, { width: c.width - 12 });
      x += c.width;
    });
    return y + headerHeight;
  }

  function drawRow(y, values, { alt = false, bold = false, shade = null } = {}) {
    if (shade) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(shade);
    } else if (alt) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.rowAlt);
    }
    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor(COLORS.ink)
        .font(bold ? "Helvetica-Bold" : c.key === "state" ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .text(values[c.key], x + 8, y + rowPadding - 4, { width: c.width - 12 });
      x += c.width;
    });
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    return y + rowHeight;
  }

  let grandTotalMiles = 0;
  let grandTotalFuel = 0;

  trips.forEach((t, tripIndex) => {
    const states = t.states || [];

    // Sub-heading for this trip, kept with its table (not orphaned at the
    // bottom of a page with the table pushed to the next one).
    ensureSpace(doc, 20 + headerHeight + rowHeight * (states.length + 2));
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accentDark)
      .text(`Trip ${tripIndex + 1}: ${t.startLocation?.formatted || "?"} to  ${t.endLocation?.formatted || "In progress"}`);
    doc.moveDown(0.4);

    let y = drawTableHeader(doc.y);

    let tripMiles = 0;
    let tripFuel = 0;

    if (states.length === 0) {
      // No state-crossings on this trip — trip.fuel is the whole story,
      // entered directly on End Trip.
      const pageCountBefore = doc.bufferedPageRange().count;
      ensureSpace(doc, rowHeight);
      if (doc.bufferedPageRange().count !== pageCountBefore) y = drawTableHeader(doc.y);
      tripFuel = t.fuel || 0;
      y = drawRow(y, {
        state: t.endLocation?.formatted || t.startLocation?.formatted || "—",
        miles: t.totalMiles ? `${t.totalMiles} mi` : "—",
        fuel: tripFuel ? `${tripFuel} gal` : "—",
      });
      tripMiles = t.totalMiles || 0;
    } else {
      states.forEach((s, i) => {
        const miles =
          s.endOdometer != null
            ? s.endOdometer - s.startOdometer
            : t.odometerEnding != null
            ? t.odometerEnding - s.startOdometer
            : null;
        if (miles != null) tripMiles += miles;
        tripFuel += s.fuel || 0;

        const pageCountBefore = doc.bufferedPageRange().count;
        ensureSpace(doc, rowHeight + headerHeight);
        if (doc.bufferedPageRange().count !== pageCountBefore) y = drawTableHeader(doc.y);

        y = drawRow(
          y,
          {
            state: s.location?.formatted || "—",
            miles: miles != null ? `${miles} mi` : "—",
            fuel: s.fuel ? `${s.fuel} gal` : "—",
          },
          { alt: i % 2 === 1 }
        );
      });
    }

    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight + headerHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) y = drawTableHeader(doc.y);
    y = drawRow(
      y,
      {
        state: `Trip ${tripIndex + 1} Total`,
        miles: `${t.totalMiles ?? tripMiles} mi`,
        fuel: `${tripFuel} gal`,
      },
      { bold: true, shade: COLORS.cardBg }
    );

    grandTotalMiles += t.totalMiles ?? tripMiles;
    grandTotalFuel += tripFuel;

    doc.y = y + 16;
  });

  // Final total across every trip in the day.
  ensureSpace(doc, headerHeight + 10);
  let y = drawTableHeader(doc.y);
  drawRow(
    y,
    { state: "All Trips — Total", miles: `${grandTotalMiles} mi`, fuel: `${grandTotalFuel} gal` },
    { bold: true, shade: "#FEE2E2" }
  );
  doc.y = y + rowHeight + 16;
}

// pdfkit has no built-in pie-slice primitive, so each wedge is approximated
// as a many-sided polygon walking the arc from startAngle to endAngle.
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
  let angle = -Math.PI / 2; // start at 12 o'clock

  entries.forEach(([status, mins]) => {
    const slice = (mins / total) * Math.PI * 2;
    drawPieSlice(doc, cx, cy, radius, angle, angle + slice, STATUS_META[status]?.color || "#CBD5E1");
    angle += slice;
  });

  // Donut hole with the grand total in the middle — gives the chart a
  // focal point instead of being a flat wedge of color.
  doc.circle(cx, cy, radius * 0.45).fill("white");
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(fmtHours(total), cx - radius * 0.4, cy - 6, { width: radius * 0.8, align: "center" });

  // Legend to the right of the chart, one line per status with its share.
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

    // The footer sits inside the page's bottom margin. Writing there with
    // doc.text() would make pdfkit think the content overflowed and
    // silently append a blank trailing page, so we zero out the bottom
    // margin for just these calls and restore it right after.
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

export async function GET() {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { start, end } = todayRange();

  const dailyLog = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  }).populate({
    path: "trips",
    options: { sort: { startdate: 1 } },
    populate: [{ path: "truck" }, { path: "trailer" }],
  });

  if (!dailyLog) {
    return NextResponse.json({ error: "No log for today" }, { status: 404 });
  }
  if (!dailyLog.dayEnded) {
    return NextResponse.json({ error: "End the day before generating a report" }, { status: 400 });
  }

  const trips = dailyLog.trips || [];

  const totalMiles = trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
  // Grand total fuel = sum of each trip's rolled-up fuel (trip.fuel), which
  // the backend already keeps in sync with every state-crossing and End
  // Trip. Do NOT also add per-state fuel here — that was the source of the
  // old double-counting bug.
  const totalFuel = trips.reduce((sum, t) => sum + totalFuelForTrip(t), 0);
  const startOdometer = trips[0]?.odometerBeginning ?? null;
  const endOdometer = [...trips].reverse().find((t) => t.odometerEnding != null)?.odometerEnding ?? null;

  const allStateNames = trips.flatMap((t) => (t.states || []).map((s) => s.location?.formatted).filter(Boolean));
  const uniqueStates = [...new Set(allStateNames)];

  const hoursByStatus = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };
  (dailyLog.statusChanges || []).forEach((s) => {
    if (hoursByStatus[s.status] !== undefined) {
      hoursByStatus[s.status] += minutesBetween(s.from, s.to);
    }
  });

  // ---- build the PDF ----
  // bufferPages lets us go back and stamp page numbers/footers on every
  // page once the total page count is known.
  const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfReady = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const dateLabel = new Date(dailyLog.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  drawHeader(doc, { dateLabel, driver });

  drawHeroStats(doc, [
    { label: "Total Miles", value: totalMiles.toLocaleString() },
    { label: "Driving Time", value: fmtHours(hoursByStatus.driving), accent: COLORS.accentSoft },
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

  sectionHeading(doc, "Mileage & Fuel by State");
  drawFuelByStateSection(doc, trips);

  drawFooters(doc);

  doc.end();
  const pdfBuffer = await pdfReady;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="daily-log-${new Date(dailyLog.date)
        .toISOString()
        .slice(0, 10)}.pdf"`,
    },
  });
}