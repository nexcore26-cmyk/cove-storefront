/**
 * Invoice PDF Generator
 * Generates a branded Cove Interior PDF invoice using pdf-lib.
 * Returns a Buffer that can be attached to emails or uploaded to S3.
 */
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  name: string;
  variantName?: string;
  image?: string;
  qty: number;
  qtyValue?: number;
  measurementType?: string;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceData {
  orderNumber: string;
  orderDate: Date;
  status: string;
  // Customer
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  // Shipping address
  address: {
    country: string;
    area?: string;
    block?: string;
    street?: string;
    avenue?: string;
    house?: string;
    paci?: string;
    notes?: string;
  };
  // Items
  items: InvoiceItem[];
  // Totals
  subtotal: number;
  shippingCost: number;
  discount?: number;
  total: number;
  currency: string;
  paymentMethod: string;
  notes?: string;
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
  obsidian: rgb(0.141, 0.141, 0.125),   // #242420
  gold:     rgb(0.616, 0.490, 0.224),   // #9D7D39
  parchment:rgb(0.980, 0.976, 0.969),   // #FAFAF8
  mist:     rgb(0.910, 0.894, 0.871),   // #E8E4DC
  stone:    rgb(0.541, 0.541, 0.510),   // #8A8A82
  white:    rgb(1, 1, 1),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'KWD') {
  return `${n.toFixed(3)} ${currency}`;
}

function drawLine(page: PDFPage, x1: number, y: number, x2: number, thickness = 0.5, color = C.mist) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = C.obsidian,
) {
  page.drawText(text, { x, y, font, size, color });
}

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Cove Interior — Invoice ${data.orderNumber}`);
  doc.setAuthor('Cove Interior');
  doc.setCreator('Cove Interior Storefront');

  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const contentWidth = width - margin * 2;

  // ── Header bar ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: C.obsidian });

  // Brand name (text-based logo)
  drawText(page, 'COVE', margin, height - 42, bold, 22, C.white);
  drawText(page, 'INTERIOR', margin + 58, height - 42, regular, 10, C.gold);

  // Invoice label (right side)
  drawText(page, 'INVOICE', width - margin - 60, height - 38, bold, 16, C.white);
  drawText(page, data.orderNumber, width - margin - 60, height - 56, regular, 9, C.gold);

  // ── Meta row ────────────────────────────────────────────────────────────────
  let y = height - 110;

  drawText(page, 'Date:', margin, y, bold, 8, C.stone);
  drawText(page, data.orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), margin + 32, y, regular, 8);

  drawText(page, 'Payment:', margin + 160, y, bold, 8, C.stone);
  drawText(page, data.paymentMethod, margin + 200, y, regular, 8);

  y -= 20;
  drawLine(page, margin, y, width - margin);

  // ── Billing / Shipping ────────────────────────────────────────────
  y -= 18;
  drawText(page, 'BILL TO', margin, y, bold, 7, C.stone);
  drawText(page, 'SHIP TO', margin + 220, y, bold, 7, C.stone);
  y -= 14;

  // ── Bill To column ──────────────────────────────────────────────
  let billY = y;
  drawText(page, truncate(data.customerName, 35), margin, billY, bold, 9);
  billY -= 13;
  drawText(page, truncate(data.customerEmail, 40), margin, billY, regular, 8, C.stone);
  if (data.customerPhone) {
    billY -= 12;
    drawText(page, data.customerPhone, margin, billY, regular, 8, C.stone);
  }

  // ── Ship To column ──────────────────────────────────────────────
  const countryNames: Record<string, string> = {
    KW: 'Kuwait', SA: 'Saudi Arabia', AE: 'UAE', BH: 'Bahrain', OM: 'Oman', QA: 'Qatar',
  };
  const countryLabel = countryNames[data.address.country] || data.address.country;

  // Build labelled address fields — only include filled fields
  const addrFields: Array<{ label: string; value: string }> = [];
  addrFields.push({ label: 'Country', value: countryLabel });
  if (data.address.area)    addrFields.push({ label: 'Area', value: data.address.area });
  if (data.address.block)   addrFields.push({ label: 'Block', value: data.address.block });
  if (data.address.street)  addrFields.push({ label: 'Street', value: data.address.street });
  if (data.address.avenue)  addrFields.push({ label: 'Avenue', value: data.address.avenue });
  if (data.address.house)   addrFields.push({ label: 'House / Building', value: data.address.house });
  if (data.address.paci)    addrFields.push({ label: 'PACI Number', value: data.address.paci });
  if (data.address.notes)   addrFields.push({ label: 'Delivery Notes', value: data.address.notes });

  let addrY = y;
  for (const field of addrFields) {
    drawText(page, field.label + ':', margin + 220, addrY, bold, 7.5, C.stone);
    drawText(page, truncate(field.value, 32), margin + 310, addrY, regular, 8);
    addrY -= 12;
  }

  y = Math.min(billY, addrY) - 16;
  drawLine(page, margin, y, width - margin);

  // ── Items table ─────────────────────────────────────────────────────────────
  // In pdf-lib, y is the BOTTOM-LEFT corner of rectangles and the BASELINE of text.
  // We step y downward (y -= height) after each row.
  y -= 14;

  // Header row: 22px tall. Rectangle bottom = y - 22, top = y.
  const headerH = 22;
  page.drawRectangle({ x: margin, y: y - headerH, width: contentWidth, height: headerH, color: C.obsidian });
  // Text baseline sits at 7px above rectangle bottom = y - headerH + 7
  const hTextY = y - headerH + 7;
  drawText(page, 'ITEM',       margin + 6,                       hTextY, bold, 7.5, C.white);
  drawText(page, 'QTY',        margin + contentWidth - 180,      hTextY, bold, 7.5, C.white);
  drawText(page, 'UNIT PRICE', margin + contentWidth - 130,      hTextY, bold, 7.5, C.white);
  drawText(page, 'TOTAL',      margin + contentWidth - 54,       hTextY, bold, 7.5, C.white);
  y -= headerH;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const rowBg = i % 2 === 0 ? C.parchment : C.white;
    const hasImage = !!item.image;
    const hasVariant = !!item.variantName;
    // Row height: 44px when image+variant, 42px image-only, 28px variant-only, 20px plain
    const rowH = hasImage && hasVariant ? 44 : hasImage ? 42 : hasVariant ? 28 : 20;
    // Rectangle: bottom = y - rowH, top = y
    page.drawRectangle({ x: margin, y: y - rowH, width: contentWidth, height: rowH, color: rowBg });

    // Draw variant image thumbnail — 36px, vertically centred in row
    let imgOffsetX = 6;
    if (hasImage) {
      try {
        const imgPath = path.join(process.cwd(), 'public', item.image!.replace(/^\//, ''));
        const imgBytes = fs.readFileSync(imgPath);
        const imgExt = item.image!.toLowerCase();
        let embeddedImg;
        if (imgExt.endsWith('.png')) {
          embeddedImg = await doc.embedPng(imgBytes);
        } else {
          embeddedImg = await doc.embedJpg(imgBytes);
        }
        const thumbSize = 36;
        // Centre thumbnail vertically: bottom of thumb = rowCentre - thumbSize/2
        const rowCentreAbs = y - rowH / 2;
        const thumbY = rowCentreAbs - thumbSize / 2;
        page.drawImage(embeddedImg, { x: margin + 4, y: thumbY, width: thumbSize, height: thumbSize });
        imgOffsetX = thumbSize + 10;
      } catch (_e) {
        // image not found or unsupported — skip silently
      }
    }

    // Text: vertically centred. Row centre baseline = y - rowH/2 - 3 (approx half cap-height)
    const rowCentreY = y - rowH / 2 - 3;
    if (hasVariant) {
      // Two lines: product name 5px above centre, variant name 7px below centre
      drawText(page, truncate(item.name, 52),          margin + imgOffsetX, rowCentreY + 5,  regular, 8);
      drawText(page, truncate(item.variantName!, 60),  margin + imgOffsetX, rowCentreY - 7,  regular, 7, C.stone);
    } else {
      drawText(page, truncate(item.name, 52),          margin + imgOffsetX, rowCentreY,      regular, 8);
    }

    // QTY / UNIT PRICE / TOTAL — vertically centred
    const colY = rowCentreY;
    const qtyLabel = item.measurementType && item.measurementType !== 'unit' && item.qtyValue
      ? `${item.qtyValue} ${item.measurementType}`
      : String(item.qty);
    drawText(page, qtyLabel,                              margin + contentWidth - 180, colY, regular, 8);
    drawText(page, fmt(item.unitPrice, data.currency),    margin + contentWidth - 130, colY, regular, 8);
    drawText(page, fmt(item.lineTotal, data.currency),    margin + contentWidth - 54,  colY, bold,    8, C.obsidian);

    y -= rowH;

    // Add new page if running out of space
    if (y < 160 && i < data.items.length - 1) {
      drawText(page, `… and ${data.items.length - i - 1} more item(s)`, margin + 6, y - 12, regular, 8, C.stone);
      break;
    }
  }

  y -= 8;
  drawLine(page, margin, y, width - margin, 1, C.obsidian);

  // ── Totals ───────────────────────────────────────────────────────────────────
  y -= 16;
  const totalsX = width - margin - 200;
  const valX    = width - margin - 10;

  const totalsRows: [string, string, boolean][] = [
    ['Subtotal', fmt(data.subtotal, data.currency), false],
    ['Shipping', data.shippingCost === 0 ? 'Free' : fmt(data.shippingCost, data.currency), false],
  ];
  if (data.discount && data.discount > 0) {
    totalsRows.push([`Discount`, `- ${fmt(data.discount, data.currency)}`, false]);
  }
  totalsRows.push(['TOTAL', fmt(data.total, data.currency), true]);

  for (const [label, value, isTotal] of totalsRows) {
    const font = isTotal ? bold : regular;
    const size = isTotal ? 10 : 8.5;
    const color = isTotal ? C.gold : C.obsidian;

    if (isTotal) {
      // Extra 10px gap before the TOTAL row
      y -= 10;
      page.drawRectangle({ x: totalsX - 10, y: y - 5, width: 210, height: 20, color: C.obsidian });
      drawText(page, label, totalsX, y + 2, bold, size, C.white);
      const valWidth = bold.widthOfTextAtSize(value, size);
      drawText(page, value, valX - valWidth, y + 2, bold, size, C.gold);
    } else {
      drawText(page, label, totalsX, y + 2, font, size, C.stone);
      const valWidth = font.widthOfTextAtSize(value, size);
      drawText(page, value, valX - valWidth, y + 2, font, size, color);
    }
    y -= isTotal ? 22 : 16;
  }

  // ── Delivery Notes ──────────────────────────────────────────────────────────
  if (data.notes) {
    y -= 10;
    drawText(page, 'DELIVERY NOTES', margin, y + 2, bold, 7.5, C.stone);
    y -= 14;
    drawText(page, data.notes, margin, y + 2, regular, 8, C.obsidian);
    y -= 10;
  }
  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = 36;
  drawLine(page, margin, footerY + 18, width - margin, 0.5, C.mist);
  drawText(page, 'Thank you for shopping with Cove Interior', margin, footerY + 6, regular, 8, C.stone);
  drawText(page, 'coveinterior.com  ·  orders@coveinterior.com', width - margin - 200, footerY + 6, regular, 8, C.stone);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
