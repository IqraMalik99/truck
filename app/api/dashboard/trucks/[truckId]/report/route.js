
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db";
import { TripSheet, Truck } from "../../../../../models/schema";


const COLORS = {
  ink: "#111827",
  subtext: "#6B7280",
  body: "#374151",
  border: "#E5E7EB",
  cardBg: "#F9FAFB",
  rowAlt: "#F8FAFC",
  divider: "#E2E8F0",
};

const PAGE_MARGIN = 50;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tripStates(trip) {
  const set = new Set();
  (trip.states || []).forEach((s) => {
    if (s.location?.formatted) set.add(s.location.formatted);
  });
  if (trip.startLocation?.formatted) set.add(trip.startLocation.formatted);
  if (trip.endLocation?.formatted) set.add(trip.endLocation.formatted);
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

function drawHeader(doc, { periodLabel, truck }) {
  const startX = doc.page.margins.left;
  const rightWidth = doc.page.width - doc.page.margins.right - startX;

  doc.fillColor(COLORS.ink).fontSize(18).font("Helvetica-Bold").text("Truck Report", startX, doc.y);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(COLORS.subtext)
    .text("Miles, drivers, and states covered", startX, doc.y + 2);
  doc.moveDown(1.4);

  const metaY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11);
  const periodHeight = doc.heightOfString(periodLabel, { width: rightWidth });
  doc.fillColor(COLORS.ink).text(periodLabel, startX, metaY, { width: rightWidth });

  const truckLabel = `Unit ${truck.unitNumber}`;
  doc.font("Helvetica-Bold").fontSize(11);
  const truckHeight = doc.heightOfString(truckLabel, { width: rightWidth, align: "right" });
  doc.fillColor(COLORS.ink).text(truckLabel, startX, metaY, { width: rightWidth, align: "right" });

  doc.y = metaY + Math.max(periodHeight, truckHeight) + 14;
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
    { key: "date", label: "Date", width: 0.14 },
    { key: "driver", label: "Driver", width: 0.18 },
    { key: "route", label: "Route", width: 0.38 },
    { key: "miles", label: "Miles", width: 0.15 },
    { key: "fuel", label: "Fuel", width: 0.15 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

  drawGenericTable(
    doc,
    columns,
    rows,
    {
      date: (r) => new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      driver: (r) => r.driver,
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
  const { truckId } = await params;

  const truck = await Truck.findById(truckId);
  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
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

  const trips = await TripSheet.find({
    truck: truck._id,
    startdate: { $gte: rangeStart, $lt: rangeEnd },
  })
    .sort({ startdate: 1 })
    .populate({ path: "driver", select: "name" });

  let totalMiles = 0;
  let totalFuel = 0;
  const daysUsed = new Set();
  const stateSet = new Set();

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
    tripStates(trip).forEach((s) => stateSet.add(s));

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
      route: `${trip.startLocation?.formatted || "?"} -> ${trip.endLocation?.formatted || "in progress"}`,
      miles,
      fuel,
    };
  });

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

  drawHeader(doc, { periodLabel, truck });

  drawHeroStats(doc, [
    { label: "Trips", value: String(trips.length) },
    { label: "Total Miles", value: totalMiles.toLocaleString() },
    { label: "Fuel Logged", value: `${totalFuel} gal` },
    { label: "Days Used", value: String(daysUsed.size), accent: "#FCA5A5" },
  ]);

  sectionHeading(doc, "States Covered");
  drawInfoLine(doc, stateSet.size ? Array.from(stateSet).join("  ·  ") : "No states logged this period.");

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
      "Content-Disposition": `attachment; filename="truck-${truck.unitNumber}-${year}-${suffix}.pdf"`,
    },
  });
}