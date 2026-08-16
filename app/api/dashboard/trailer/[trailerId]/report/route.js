import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectDB } from "../../../../../lib/db";
import { TripSheet, Trailer } from "../../../../../models/schema";


const COLORS = {
  ink: "#0F172A",
  subtext: "#64748B",
  body: "#334155",
  border: "#E2E8F0",
  cardBg: "#F8FAFC",
  rowAlt: "#EFF6FF",
  divider: "#E2E8F0",
  accent: "#2563EB",
  accentDark: "#1E3A8A",
  accentSoft: "#93C5FD",
};

const PAGE_MARGIN = 50;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// `location.formatted` is an optional field — nothing guarantees it's set
// when a trip/state is created. Fall back to city/state/country instead of
// silently dropping the location (the earlier bug: any state without a
// `formatted` value never showed up anywhere in the report).
function formatLocation(loc) {
  if (!loc) return null;
  if (loc.formatted) return loc.formatted;
  const parts = [loc.city, loc.state, loc.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function tripStates(trip) {
  const set = new Set();
  (trip.states || []).forEach((s) => {
    const name = formatLocation(s.location);
    if (name) set.add(name);
  });
  const start = formatLocation(trip.startLocation);
  if (start) set.add(start);
  const end = formatLocation(trip.endLocation);
  if (end) set.add(end);
  return Array.from(set);
}

function resolvePeriod({ year, period, month, quarter, half }) {
  if (period === "quarter") {
    const q = Math.min(4, Math.max(1, parseInt(quarter || "1", 10)));
    const startMonth = (q - 1) * 3 + 1;
    return {
      months: [startMonth, startMonth + 1, startMonth + 2],
      label: `Q${q} ${year}`,
      suffix: `Q${q}`,
    };
  }
  if (period === "half") {
    const h = Math.min(2, Math.max(1, parseInt(half || "1", 10)));
    const startMonth = h === 1 ? 1 : 7;
    return {
      months: [startMonth, startMonth + 1, startMonth + 2, startMonth + 3, startMonth + 4, startMonth + 5],
      label: `H${h} ${year}`,
      suffix: `H${h}`,
    };
  }
  if (period === "year") {
    return {
      months: Array.from({ length: 12 }, (_, i) => i + 1),
      label: `${year} full year`,
      suffix: "FullYear",
    };
  }
  const m = Math.min(12, Math.max(1, parseInt(month || "1", 10)));
  return {
    months: [m],
    label: new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    suffix: String(m).padStart(2, "0"),
  };
}

function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) doc.addPage();
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

function drawHeader(doc, { periodLabel, trailer }) {
  const startX = doc.page.margins.left;
  const rightWidth = doc.page.width - doc.page.margins.right - startX;

  doc.fillColor(COLORS.ink).fontSize(18).font("Helvetica-Bold").text("Trailer Report", startX, doc.y);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(COLORS.subtext)
    .text("Miles, drivers, trucks, and states covered", startX, doc.y + 2);
  doc.moveDown(1.4);

  const metaY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11);
  const periodHeight = doc.heightOfString(periodLabel, { width: rightWidth });
  doc.fillColor(COLORS.ink).text(periodLabel, startX, metaY, { width: rightWidth });

  const trailerLabel = `Trailer ${trailer.trailerNumber}`;
  doc.font("Helvetica-Bold").fontSize(11);
  const trailerHeight = doc.heightOfString(trailerLabel, { width: rightWidth, align: "right" });
  doc.fillColor(COLORS.ink).text(trailerLabel, startX, metaY, { width: rightWidth, align: "right" });

  doc.y = metaY + Math.max(periodHeight, trailerHeight) + 14;
}

// A dedicated, hard-to-miss banner for this trailer's lifetime trip count —
// same pattern as the driver and truck reports, so every report type in
// the product reads consistently: "big picture" first, then the numbers
// for the selected period.
function drawLifetimeTripsBlock(doc, trailer, totalTripsAllTime) {
  const startX = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const blockHeight = 56;
  const y = doc.y;

  doc.roundedRect(startX, y, width, blockHeight, 8).fill(COLORS.accent);

  const iconCx = startX + 34;
  const iconCy = y + blockHeight / 2;
  doc.circle(iconCx, iconCy, 16).fill("white");
  doc
    .save()
    .strokeColor(COLORS.accent)
    .lineWidth(2.5)
    .moveTo(iconCx - 7, iconCy + 3)
    .lineTo(iconCx - 2, iconCy - 5)
    .lineTo(iconCx + 3, iconCy)
    .lineTo(iconCx + 8, iconCy - 7)
    .stroke()
    .restore();

  const textX = startX + 62;
  const textWidth = width - 62 - 200;

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Total Trips Completed (All-Time)", textX, y + 12, { width: textWidth });
  doc
    .fillColor("#DBEAFE")
    .font("Helvetica")
    .fontSize(8.5)
    .text(`Across every logged trip for Trailer ${trailer.trailerNumber}`, textX, y + 30, { width: textWidth });

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(30)
    .text(totalTripsAllTime.toLocaleString(), startX + width - 200, y + 10, {
      width: 180,
      align: "right",
    });

  doc.y = y + blockHeight + 20;
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
      .fontSize(stats.length > 3 ? 20 : 24)
      .text(s.value, x, y + 14, { width: colWidth, align: "center" });
    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(9)
      .text(s.label.toUpperCase(), x, y + 48, { width: colWidth, align: "center", characterSpacing: 0.5 });
  });
  doc.y = y + bandHeight + 20;
}

function drawInfoLine(doc, text) {
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textWidth = boxWidth - 24;

  doc.font("Helvetica").fontSize(10);
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const boxHeight = Math.max(34, textHeight + 20);

  ensureSpace(doc, boxHeight + 10);
  const boxY = doc.y;
  doc
    .roundedRect(doc.page.margins.left, boxY, boxWidth, boxHeight, 6)
    .fillAndStroke(COLORS.cardBg, COLORS.border);
  doc
    .fillColor(COLORS.body)
    .font("Helvetica")
    .fontSize(10)
    .text(text, doc.page.margins.left + 12, boxY + (boxHeight - textHeight) / 2, { width: textWidth });

  doc.y = boxY + boxHeight + 16;
}

// States Covered, as a multi-column list (top-to-bottom then left-to-right)
// with each state paired with a count pill showing how many trips touched
// it this period — same layout used in the driver and truck reports, so
// every report type in the product looks consistent. `entries` is
// [stateName, count], pre-sorted by the caller (most-visited first).
function drawStatesColumns(doc, entries, cols = 3) {
  if (!entries.length) {
    drawInfoLine(doc, "No states logged this period.");
    return;
  }

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 16;
  const colWidth = (pageWidth - gap * (cols - 1)) / cols;
  const startX = doc.page.margins.left;
  const pillWidth = 26;
  const textWidth = colWidth - pillWidth - 8;
  const rowGap = 8;

  const rows = Math.ceil(entries.length / cols);

  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    let maxH = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= entries.length) continue;
      const h = doc.heightOfString(entries[idx][0], { width: textWidth, fontSize: 10 });
      maxH = Math.max(maxH, h);
    }
    rowHeights.push(Math.max(maxH, 16) + rowGap);
  }

  let y = doc.y;

  for (let r = 0; r < rows; r++) {
    const rowHeight = rowHeights[r];

    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) {
      y = doc.y;
    }

    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= entries.length) continue;
      const [name, count] = entries[idx];
      const x = startX + c * (colWidth + gap);

      doc.roundedRect(x, y, pillWidth, 16, 8).fill(COLORS.accent);
      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text(String(count), x, y + 4, { width: pillWidth, align: "center" });

      doc
        .fillColor(COLORS.body)
        .font("Helvetica")
        .fontSize(10)
        .text(name, x + pillWidth + 8, y + 2, { width: textWidth });
    }

    y += rowHeight;
  }

  doc.y = y + 10;
}

function drawGenericTable(doc, columns, rows, cellFns, emptyText) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 22;
  const rowHeight = 22;

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

  ensureSpace(doc, headerHeight + rowHeight + 10);
  let y = drawTableHeader(doc.y);

  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#9CA3AF")
      .text(emptyText, startX + 8, y + 8, { width: tableWidth - 16 });
    doc.y = y + 28;
    return;
  }

  rows.forEach((r, i) => {
    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight + headerHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) {
      y = drawTableHeader(doc.y);
    }
    if (i % 2 === 1) doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.rowAlt);

    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor(c.key === "date" || c.key === "month" ? COLORS.ink : COLORS.body)
        .font(c.key === "date" || c.key === "month" ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8.5)
        .text(cellFns[c.key](r), x + 8, y + 6, { width: c.width - 12, ellipsis: true });
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

function drawTripsTable(doc, rows) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: "date", label: "Date", width: 0.12 },
    { key: "driver", label: "Driver", width: 0.16 },
    { key: "truck", label: "Truck", width: 0.12 },
    { key: "route", label: "Route", width: 0.32 },
    { key: "miles", label: "Miles", width: 0.14 },
    { key: "fuel", label: "Fuel", width: 0.14 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

  drawGenericTable(
    doc,
    columns,
    rows,
    {
      date: (r) => new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      driver: (r) => r.driver,
      truck: (r) => r.truck,
      route: (r) => r.route,
      miles: (r) => (r.miles ? `${r.miles} mi` : "—"),
      fuel: (r) => (r.fuel ? `${r.fuel} gal` : "—"),
    },
    "No trips logged this period."
  );
}

function drawMonthSummaryTable(doc, rows) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: "month", label: "Month", width: 0.2 },
    { key: "trips", label: "Trips", width: 0.16 },
    { key: "miles", label: "Miles", width: 0.22 },
    { key: "fuel", label: "Fuel", width: 0.2 },
    { key: "days", label: "Days Used", width: 0.22 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

  drawGenericTable(
    doc,
    columns,
    rows,
    {
      month: (r) => r.monthLabel,
      trips: (r) => String(r.tripsCount),
      miles: (r) => `${r.milesTotal.toLocaleString()} mi`,
      fuel: (r) => `${r.fuelTotal} gal`,
      days: (r) => String(r.daysUsed),
    },
    "No trips logged this period."
  );
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
      .text(`Generated ${new Date().toLocaleString()}`, doc.page.margins.left, bottom, {
        width: 250,
        align: "left",
        lineBreak: false,
      });
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
  await connectDB();
  const { trailerId } = await params;

  const trailer = await Trailer.findById(trailerId);
  if (!trailer) {
    return NextResponse.json({ error: "Trailer not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") || now.getFullYear(), 10);
  const period = searchParams.get("period") || "month"; // month | quarter | half | year

  const { months, label: periodLabel, suffix } = resolvePeriod({
    year,
    period,
    month: searchParams.get("month"),
    quarter: searchParams.get("quarter"),
    half: searchParams.get("half"),
  });

  const rangeStart = new Date(year, months[0] - 1, 1);
  const rangeEnd = new Date(year, months[months.length - 1], 1);

  // Lifetime trip count for this trailer — a plain count against TripSheet
  // with NO date filter, independent of the period being viewed, so it
  // always reflects every trip this trailer has ever been on, not just
  // this period's.
  const totalTripsAllTime = await TripSheet.countDocuments({ trailer: trailer._id });

  const trips = await TripSheet.find({
    trailer: trailer._id,
    startdate: { $gte: rangeStart, $lt: rangeEnd },
  })
    .sort({ startdate: 1 })
    .populate({ path: "driver", select: "name" })
    .populate({ path: "truck", select: "unitNumber" });

  let totalMiles = 0;
  let totalFuel = 0;
  const daysUsed = new Set();

  // States touched this period, tallied (not just deduped) so the section
  // can show "how many" alongside "which ones" — same approach as the
  // driver and truck reports.
  const stateCounts = new Map();

  const monthBuckets = new Map(
    months.map((m) => [m, { tripsCount: 0, milesTotal: 0, fuelTotal: 0, daysUsed: new Set() }])
  );

  const tripRows = trips.map((trip) => {
    const miles = trip.totalMiles || 0;
    const fuel = trip.fuel || 0;
    const dayKey = new Date(trip.startdate).toDateString();
    const m = new Date(trip.startdate).getMonth() + 1;

    totalMiles += miles;
    totalFuel += fuel;
    daysUsed.add(dayKey);
    tripStates(trip).forEach((s) => stateCounts.set(s, (stateCounts.get(s) || 0) + 1));

    const bucket = monthBuckets.get(m);
    if (bucket) {
      bucket.tripsCount += 1;
      bucket.milesTotal += miles;
      bucket.fuelTotal += fuel;
      bucket.daysUsed.add(dayKey);
    }

    return {
      date: trip.startdate,
      driver: trip.driver?.name || "Unknown",
      truck: trip.truck?.unitNumber ? `Unit ${trip.truck.unitNumber}` : "Unknown",
      route: `${formatLocation(trip.startLocation) || "?"} -> ${formatLocation(trip.endLocation) || "in progress"}`,
      miles,
      fuel,
    };
  });

  // Most-visited state first, ties broken alphabetically.
  const stateEntries = [...stateCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const monthSummaryRows = months.map((m) => {
    const b = monthBuckets.get(m);
    return {
      monthLabel: `${MONTH_NAMES[m - 1]} ${year}`,
      tripsCount: b.tripsCount,
      milesTotal: b.milesTotal,
      fuelTotal: b.fuelTotal,
      daysUsed: b.daysUsed.size,
    };
  });

  const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfReady = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawHeader(doc, { periodLabel, trailer });

  drawLifetimeTripsBlock(doc, trailer, totalTripsAllTime);

  drawHeroStats(doc, [
    { label: "Trips", value: String(trips.length) },
    { label: "Total Miles", value: totalMiles.toLocaleString() },
    { label: "Fuel Logged", value: `${totalFuel} gal` },
    { label: "Days Used", value: String(daysUsed.size), accent: COLORS.accentSoft },
  ]);

  sectionHeading(doc, "States Covered");
  drawStatesColumns(doc, stateEntries, 3);

  if (period === "month") {
    sectionHeading(doc, "Trips");
    drawTripsTable(doc, tripRows);
  } else {
    sectionHeading(doc, "Monthly Breakdown");
    drawMonthSummaryTable(doc, monthSummaryRows);
  }

  drawFooters(doc);

  doc.end();
  const pdfBuffer = await pdfReady;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="trailer-${trailer.trailerNumber}-${year}-${suffix}.pdf"`,
    },
  });
}