import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { connectDB } from "../../../../../../lib/db";
import { DriverDailyLog, Driver } from "../../../../../../models/schema";



// npm install pdfkit
//
// Brief monthly summary — not a day-by-day retread of the daily report.
// Just totals + a short table so an admin can see the month at a glance.

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

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dayTotals(log) {
  const trips = log.trips || [];
  const statusChanges = log.statusChanges || [];
  const miles = trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
  const fuel = trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
  let driving = 0;
  statusChanges.forEach((s) => {
    if (s.status === "driving") driving += minutesBetween(s.from, s.to);
  });
  return { miles, fuel, driving };
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

function drawHeader(doc, { monthLabel, driver }) {
  const startX = doc.page.margins.left;
  const rightWidth = doc.page.width - doc.page.margins.right - startX;

  doc
    .fillColor(COLORS.ink)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("Monthly Driver Log Summary", startX, doc.y);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(COLORS.subtext)
    .text("Brief overview — see daily reports for full detail", startX, doc.y + 2);
  doc.moveDown(1.4);

  const metaY = doc.y;

  doc.font("Helvetica-Bold").fontSize(11);
  const monthHeight = doc.heightOfString(monthLabel, { width: rightWidth });
  doc.fillColor(COLORS.ink).text(monthLabel, startX, metaY, { width: rightWidth });

  const driverName = driver?.name || "—";
  doc.font("Helvetica-Bold").fontSize(11);
  const nameHeight = doc.heightOfString(driverName, { width: rightWidth, align: "right" });
  doc.fillColor(COLORS.ink).text(driverName, startX, metaY, { width: rightWidth, align: "right" });

  let bottomY = metaY + Math.max(monthHeight, nameHeight);

  const contactLine = [driver?.carrierName, driver?.email, driver?.phone]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    const contactY = metaY + nameHeight + 3;
    doc.font("Helvetica").fontSize(9);
    const contactHeight = doc.heightOfString(contactLine, { width: rightWidth, align: "right" });
    doc.fillColor(COLORS.subtext).text(contactLine, startX, contactY, { width: rightWidth, align: "right" });
    bottomY = Math.max(bottomY, contactY + contactHeight);
  }

  doc.y = bottomY + 14;
}

function drawSummarySentence(doc, text) {
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
    .text(text, doc.page.margins.left + 12, boxY + (boxHeight - textHeight) / 2, {
      width: textWidth,
    });

  doc.y = boxY + boxHeight + 16;
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



function drawDaysTable(doc, rows) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: "date", label: "Date", width: 0.28 },
    { key: "status", label: "Status", width: 0.2 },
    { key: "miles", label: "Miles", width: 0.18 },
    { key: "fuel", label: "Fuel", width: 0.17 },
    { key: "driving", label: "Driving", width: 0.17 },
  ].map((c) => ({ ...c, width: c.width * tableWidth }));

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
      .text("No days logged this month.", startX + 8, y + 8, { width: tableWidth - 16 });
    doc.y = y + 8 + 20;
    return;
  }

  rows.forEach((r, i) => {
    const pageCountBefore = doc.bufferedPageRange().count;
    ensureSpace(doc, rowHeight + headerHeight);
    if (doc.bufferedPageRange().count !== pageCountBefore) {
      y = drawTableHeader(doc.y);
    }

    if (i % 2 === 1) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.rowAlt);
    }

    const cellValues = {
      date: r.dateLabel,
      status: r.dayEnded ? "Closed" : "Open",
      miles: r.miles ? `${r.miles} mi` : "—",
      fuel: r.fuel ? `${r.fuel} gal` : "—",
      driving: fmtHours(r.driving),
    };

    let x = startX;
    columns.forEach((c) => {
      doc
        .fillColor(c.key === "date" ? COLORS.ink : COLORS.body)
        .font(c.key === "date" ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .text(cellValues[c.key], x + 8, y + 6, { width: c.width - 12 });
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
      .text(`Report Monthly`, doc.page.margins.left, bottom, {
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

  const { driverId } = await params;
  if (!driverId) {
    return NextResponse.json({ error: "Missing driverId" }, { status: 400 });
  }

  const driver = await Driver.findById(driverId);
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") || now.getFullYear(), 10);
  const month = parseInt(searchParams.get("month") || now.getMonth() + 1, 10); // 1-12

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const logs = await DriverDailyLog.find({
    driver: driver._id,
    date: { $gte: monthStart, $lt: monthEnd },
  })
    .sort({ date: 1 })
    .populate({ path: "trips" });

  const totalDaysInMonth = daysInMonth(year, month);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const asOfDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;

  let totalMiles = 0;
  let totalFuel = 0;
  let totalDriving = 0;

  const rows = logs.map((log) => {
    const t = dayTotals(log);
    totalMiles += t.miles;
    totalFuel += t.fuel;
    totalDriving += t.driving;
    return {
      dateLabel: new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dayEnded: !!log.dayEnded,
      miles: t.miles,
      fuel: t.fuel,
      driving: t.driving,
    };
  });

  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const summarySentence = `${logs.length} of ${asOfDay} day(s) logged so far this month, totaling ${totalMiles} mi, ${totalFuel} gal fuel, and ${fmtHours(
    totalDriving
  )} driving.`;

  const doc = new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfReady = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawHeader(doc, { monthLabel, driver });

  drawHeroStats(doc, [
    { label: "Days Logged", value: String(logs.length) },
    { label: "Total Miles", value: totalMiles.toLocaleString() },
    { label: "Fuel Logged", value: `${totalFuel} gal` },
    { label: "Driving Time", value: fmtHours(totalDriving), accent: "#FCA5A5" },
  ]);

  drawSummarySentence(doc, summarySentence);

  sectionHeading(doc, "Days");
  drawDaysTable(doc, rows);

  drawFooters(doc);

  doc.end();
  const pdfBuffer = await pdfReady;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${driver.name || "driver"}-monthly-log-${year}-${String(
        month
      ).padStart(2, "0")}.pdf"`,
    },
  });
}