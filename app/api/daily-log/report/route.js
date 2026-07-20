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
// independently-styled blocks.
// ---------------------------------------------------------------------------
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
  const totalFuel = trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
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