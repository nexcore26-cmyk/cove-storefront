/**
 * Email Service — Transactional emails via Resend
 * Sends order confirmation and status change notifications to customers.
 */
import { Resend } from 'resend';
import { ENV } from './_core/env';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!ENV.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(ENV.resendApiKey);
  return resendClient;
}

// ─── HTML Email Templates ────────────────────────────────────────────────────

const brandColor = '#9D7D39';
const darkColor = '#111110';
const lightBg = '#FAFAF8';
const mutedColor = '#8A8A82';
const borderColor = '#E8E4DC';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cove Interior</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${lightBg};border-radius:8px;overflow:hidden;border:1px solid ${borderColor};">
          <!-- Header -->
          <tr>
            <td style="background-color:${darkColor};padding:24px 32px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:300;color:${lightBg};letter-spacing:3px;text-transform:uppercase;">COVE INTERIOR</p>
              <p style="margin:4px 0 0;font-size:11px;color:${brandColor};letter-spacing:2px;text-transform:uppercase;">Luxury Home Decor</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F5F0E8;padding:20px 32px;border-top:1px solid ${borderColor};text-align:center;">
              <p style="margin:0;font-size:11px;color:${mutedColor};letter-spacing:1px;">© ${new Date().getFullYear()} Cove Interior · Kuwait</p>
              <p style="margin:4px 0 0;font-size:11px;color:${mutedColor};">
                <a href="https://coveinterior.com" style="color:${brandColor};text-decoration:none;">coveinterior.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function itemsTable(items: OrderItem[]): string {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};">
        <p style="margin:0;font-size:13px;color:${darkColor};font-weight:500;">${item.productName}</p>
        ${item.variantName ? `<p style="margin:2px 0 0;font-size:11px;color:${mutedColor};">${item.variantName}</p>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:center;font-size:13px;color:${mutedColor};">×${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${borderColor};text-align:right;font-size:13px;color:${darkColor};">${parseFloat(String(item.unitPrice)).toFixed(3)} KWD</td>
    </tr>
  `).join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};padding-bottom:8px;border-bottom:2px solid ${borderColor};">Product</th>
          <th style="text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};padding-bottom:8px;border-bottom:2px solid ${borderColor};">Qty</th>
          <th style="text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};padding-bottom:8px;border-bottom:2px solid ${borderColor};">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number | string;
}

export interface OrderConfirmationData {
  orderNumber: string | number;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number | string;
  shippingCost: number | string;
  discount?: number | string;
  total: number | string;
  shippingAddress?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  notes?: string | null;
  /** Optional PDF invoice buffer — attached to the email if provided */
  invoicePdf?: Buffer | null;
}

export interface OrderStatusChangeData {
  orderNumber: string | number;
  customerName: string;
  customerEmail: string;
  newStatus: string;
  trackingNumber?: string | null;
  items: OrderItem[];
  total: number | string;
}

// ─── Status Label Map ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; message: string }> = {
  processing: { label: 'Processing', color: '#3B82F6', message: 'Your order is being processed and will be prepared for shipment soon.' },
  shipped: { label: 'Shipped', color: '#8B5CF6', message: 'Your order has been shipped and is on its way to you.' },
  delivered: { label: 'Delivered', color: '#10B981', message: 'Your order has been delivered. We hope you love your new pieces!' },
  completed: { label: 'Completed', color: '#10B981', message: 'Your order is complete. Thank you for shopping with Cove Interior.' },
  cancelled: { label: 'Cancelled', color: '#EF4444', message: 'Your order has been cancelled. If you have questions, please contact us.' },
  refunded: { label: 'Refunded', color: '#F59E0B', message: 'Your order has been refunded. The amount will be returned to your original payment method.' },
  on_hold: { label: 'On Hold', color: '#F59E0B', message: 'Your order is currently on hold. We will contact you shortly.' },
};

// ─── Send Functions ──────────────────────────────────────────────────────────

export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping order confirmation email');
    return false;
  }

  const subtotal = parseFloat(String(data.subtotal)).toFixed(3);
  const shipping = parseFloat(String(data.shippingCost)).toFixed(3);
  const discount = data.discount ? parseFloat(String(data.discount)) : 0;
  const total = parseFloat(String(data.total)).toFixed(3);

  const addressLines = data.shippingAddress
    ? [data.shippingAddress.line1, data.shippingAddress.line2, data.shippingAddress.city, data.shippingAddress.country]
        .filter(Boolean).join(', ')
    : null;

  const body = `
    <h2 style="margin:0 0 4px;font-family:Georgia,serif;font-size:24px;font-weight:300;color:${darkColor};">Order Confirmed</h2>
    <p style="margin:0 0 24px;font-size:13px;color:${mutedColor};">Thank you, ${data.customerName}. Your order has been received.</p>

    <div style="background-color:#F5F0E8;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};">Order Number</p>
      <p style="margin:4px 0 0;font-size:20px;font-family:Georgia,serif;color:${darkColor};">#${data.orderNumber}</p>
    </div>

    ${itemsTable(data.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="font-size:12px;color:${mutedColor};padding:4px 0;">Subtotal</td>
        <td style="font-size:12px;color:${darkColor};text-align:right;padding:4px 0;">${subtotal} KWD</td>
      </tr>
      <tr>
        <td style="font-size:12px;color:${mutedColor};padding:4px 0;">Shipping</td>
        <td style="font-size:12px;color:${darkColor};text-align:right;padding:4px 0;">${shipping} KWD</td>
      </tr>
      ${discount > 0 ? `<tr>
        <td style="font-size:12px;color:#10B981;padding:4px 0;">Discount</td>
        <td style="font-size:12px;color:#10B981;text-align:right;padding:4px 0;">−${discount.toFixed(3)} KWD</td>
      </tr>` : ''}
      <tr>
        <td style="font-size:15px;font-weight:600;color:${darkColor};padding:12px 0 4px;border-top:1px solid ${borderColor};">Total</td>
        <td style="font-size:15px;font-weight:600;color:${brandColor};text-align:right;padding:12px 0 4px;border-top:1px solid ${borderColor};">${total} KWD</td>
      </tr>
    </table>

    ${addressLines ? `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid ${borderColor};">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};">Shipping Address</p>
      <p style="margin:0;font-size:13px;color:${darkColor};">${addressLines}</p>
    </div>` : ''}

    ${data.notes ? `
    <div style="margin-top:16px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};">Order Notes</p>
      <p style="margin:0;font-size:13px;color:${darkColor};">${data.notes}</p>
    </div>` : ''}

    <p style="margin:28px 0 0;font-size:12px;color:${mutedColor};line-height:1.6;">
      If you have any questions about your order, please contact us at
      <a href="mailto:info@coveinterior.com" style="color:${brandColor};">info@coveinterior.com</a>
    </p>
  `;

  try {
    await resend.emails.send({
      from: ENV.emailFrom,
      to: data.customerEmail,
      subject: `Order Confirmed — #${data.orderNumber} | Cove Interior`,
      html: emailWrapper(body),
      ...(data.invoicePdf ? {
        attachments: [{
          filename: `invoice-${data.orderNumber}.pdf`,
          content: data.invoicePdf,
        }],
      } : {}),
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send order confirmation:', err);
    return false;
  }
}

export async function sendOrderStatusChange(data: OrderStatusChangeData): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping status change email');
    return false;
  }

  const statusInfo = STATUS_LABELS[data.newStatus] || {
    label: data.newStatus.charAt(0).toUpperCase() + data.newStatus.slice(1),
    color: brandColor,
    message: `Your order status has been updated to ${data.newStatus}.`,
  };

  const total = parseFloat(String(data.total)).toFixed(3);

  const body = `
    <h2 style="margin:0 0 4px;font-family:Georgia,serif;font-size:24px;font-weight:300;color:${darkColor};">Order Update</h2>
    <p style="margin:0 0 24px;font-size:13px;color:${mutedColor};">Hello ${data.customerName}, here is an update on your order.</p>

    <div style="background-color:#F5F0E8;border-radius:6px;padding:16px;margin-bottom:24px;display:flex;align-items:center;gap:16px;">
      <div>
        <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};">Order #${data.orderNumber}</p>
        <p style="margin:6px 0 0;display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;background-color:${statusInfo.color}20;color:${statusInfo.color};">${statusInfo.label}</p>
      </div>
    </div>

    <p style="margin:0 0 24px;font-size:14px;color:${darkColor};line-height:1.6;">${statusInfo.message}</p>

    ${data.trackingNumber ? `
    <div style="background-color:#F5F0E8;border-radius:6px;padding:16px;margin-bottom:24px;border-left:3px solid ${brandColor};">
      <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${mutedColor};">Tracking Number</p>
      <p style="margin:4px 0 0;font-size:16px;font-family:monospace;color:${darkColor};font-weight:600;">${data.trackingNumber}</p>
    </div>` : ''}

    ${itemsTable(data.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tr>
        <td style="font-size:15px;font-weight:600;color:${darkColor};padding:12px 0 4px;border-top:1px solid ${borderColor};">Total</td>
        <td style="font-size:15px;font-weight:600;color:${brandColor};text-align:right;padding:12px 0 4px;border-top:1px solid ${borderColor};">${total} KWD</td>
      </tr>
    </table>

    <p style="margin:28px 0 0;font-size:12px;color:${mutedColor};line-height:1.6;">
      Questions? Contact us at
      <a href="mailto:info@coveinterior.com" style="color:${brandColor};">info@coveinterior.com</a>
    </p>
  `;

  try {
    await resend.emails.send({
      from: ENV.emailFrom,
      to: data.customerEmail,
      subject: `Order ${statusInfo.label} — #${data.orderNumber} | Cove Interior`,
      html: emailWrapper(body),
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send status change email:', err);
    return false;
  }
}

// ─── Admin New Order Notification ────────────────────────────────────────────

export interface AdminNewOrderData {
  orderNumber: string | number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  items: OrderItem[];
  subtotal: number | string;
  shippingCost: number | string;
  discount?: number | string;
  total: number | string;
  currency?: string;
  shippingAddress?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  notes?: string | null;
  orderId: number;
  /** Optional PDF invoice buffer — attached to the email if provided */
  invoicePdf?: Buffer | null;
}

export async function sendAdminNewOrder(data: AdminNewOrderData): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const currency = data.currency || 'KWD';
  const subtotal = parseFloat(String(data.subtotal)).toFixed(3);
  const shipping = parseFloat(String(data.shippingCost)).toFixed(3);
  const discount = data.discount ? parseFloat(String(data.discount)) : 0;
  const total = parseFloat(String(data.total)).toFixed(3);

  const addressLines = data.shippingAddress
    ? [data.shippingAddress.line1, data.shippingAddress.line2, data.shippingAddress.city, data.shippingAddress.country]
        .filter(Boolean).join(', ')
    : null;

  const kuwaitTime = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Kuwait',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:${brandColor};margin:0 0 4px;letter-spacing:1px;">
      NEW ORDER #${data.orderNumber}
    </h2>
    <p style="font-size:13px;color:${mutedColor};margin:0 0 24px;">
      Placed on ${kuwaitTime} (Kuwait Time)
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#F5F0E8;border-radius:6px;padding:16px;">
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Customer</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;font-weight:600;">${data.customerName}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Email</td>
        <td style="font-size:13px;padding:4px 0;text-align:right;">
          <a href="mailto:${data.customerEmail}" style="color:${brandColor};">${data.customerEmail}</a>
        </td>
      </tr>
      ${data.customerPhone ? `
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Phone</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;">${data.customerPhone}</td>
      </tr>` : ''}
      ${addressLines ? `
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;vertical-align:top;">Ship To</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;">${addressLines}</td>
      </tr>` : ''}
      ${data.notes ? `
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;vertical-align:top;">Notes</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;font-style:italic;">${data.notes}</td>
      </tr>` : ''}
    </table>

    ${itemsTable(data.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tr>
        <td style="font-size:12px;color:${mutedColor};padding:4px 0;">Subtotal</td>
        <td style="font-size:12px;color:${darkColor};text-align:right;padding:4px 0;">${subtotal} ${currency}</td>
      </tr>
      <tr>
        <td style="font-size:12px;color:${mutedColor};padding:4px 0;">Shipping</td>
        <td style="font-size:12px;color:${darkColor};text-align:right;padding:4px 0;">${shipping} ${currency}</td>
      </tr>
      ${discount > 0 ? `<tr>
        <td style="font-size:12px;color:#10B981;padding:4px 0;">Discount</td>
        <td style="font-size:12px;color:#10B981;text-align:right;padding:4px 0;">−${discount.toFixed(3)} ${currency}</td>
      </tr>` : ''}
      <tr>
        <td style="font-size:15px;font-weight:700;color:${darkColor};padding:12px 0 4px;border-top:1px solid ${borderColor};">Total</td>
        <td style="font-size:15px;font-weight:700;color:${brandColor};text-align:right;padding:12px 0 4px;border-top:1px solid ${borderColor};">${total} ${currency}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:${mutedColor};">
      View this order in the
      <a href="https://coveinterior.com/admin/orders/${data.orderId}" style="color:${brandColor};">Admin Panel →</a>
    </p>
  `;

  try {
    await resend.emails.send({
      from: ENV.emailFrom,
      to: 'orders@coveinterior.com',
      subject: `🛍 New Order #${data.orderNumber} — ${total} ${currency} | Cove Interior`,
      html: emailWrapper(body),
      ...(data.invoicePdf ? {
        attachments: [{
          filename: `invoice-${data.orderNumber}.pdf`,
          content: data.invoicePdf,
        }],
      } : {}),
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send admin new order notification:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ORDER NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface VendorOrderNotificationData {
  vendorName: string;
  vendorEmail: string;
  orderNumber: string;
  orderId: number;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    commissionPercent: number;
  }>;
  subtotal: number;
  commissionTotal: number;
  currency?: string;
}

export async function sendVendorOrderNotification(data: VendorOrderNotificationData): Promise<boolean> {
  const brandColor = "#B8860B";
  const darkColor = "#1F2937";
  const mutedColor = "#6B7280";
  const borderColor = "#E5E7EB";
  const currency = data.currency || "KWD";

  const itemsRows = data.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid ${borderColor};">
      <td style="font-size:13px;color:${darkColor};padding:8px 0;">${item.productName}</td>
      <td style="font-size:13px;color:${darkColor};padding:8px 0;text-align:center;">${item.quantity}</td>
      <td style="font-size:13px;color:${darkColor};padding:8px 0;text-align:right;">${parseFloat(String(item.unitPrice)).toFixed(3)} ${currency}</td>
      <td style="font-size:13px;color:${darkColor};padding:8px 0;text-align:right;">${item.commissionPercent}%</td>
      <td style="font-size:13px;color:${brandColor};padding:8px 0;text-align:right;font-weight:600;">${(
        (item.unitPrice * item.quantity * item.commissionPercent) /
        100
      ).toFixed(3)} ${currency}</td>
    </tr>
  `
    )
    .join("");

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:${brandColor};margin:0 0 4px;letter-spacing:1px;">
      NEW ORDER #${data.orderNumber}
    </h2>
    <p style="font-size:13px;color:${mutedColor};margin:0 0 24px;">
      Customer: ${data.customerName}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#F5F0E8;border-radius:6px;padding:16px;">
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Order #</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;font-weight:600;">${data.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Customer</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;">${data.customerName}</td>
      </tr>
    </table>
    <h3 style="font-size:14px;font-weight:600;color:${darkColor};margin:16px 0 8px;">Your Commission Items</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr style="background:#F5F0E8;">
        <th style="font-size:12px;font-weight:600;color:${darkColor};padding:8px;text-align:left;">Product</th>
        <th style="font-size:12px;font-weight:600;color:${darkColor};padding:8px;text-align:center;">Qty</th>
        <th style="font-size:12px;font-weight:600;color:${darkColor};padding:8px;text-align:right;">Unit Price</th>
        <th style="font-size:12px;font-weight:600;color:${darkColor};padding:8px;text-align:right;">%</th>
        <th style="font-size:12px;font-weight:600;color:${brandColor};padding:8px;text-align:right;">Commission</th>
      </tr>
      ${itemsRows}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tr>
        <td style="font-size:13px;color:${mutedColor};padding:4px 0;">Order Subtotal</td>
        <td style="font-size:13px;color:${darkColor};text-align:right;padding:4px 0;">${parseFloat(String(data.subtotal)).toFixed(3)} ${currency}</td>
      </tr>
      <tr>
        <td style="font-size:15px;font-weight:700;color:${darkColor};padding:12px 0 4px;border-top:2px solid ${brandColor};">Your Commission</td>
        <td style="font-size:15px;font-weight:700;color:${brandColor};text-align:right;padding:12px 0 4px;border-top:2px solid ${brandColor};">${parseFloat(String(data.commissionTotal)).toFixed(3)} ${currency}</td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:${mutedColor};">
      View this order in your
      <a href="https://admin.coveinterior.com/vendor/login" style="color:${brandColor};">Vendor Portal →</a>
    </p>
  `;

  try {
    await resend.emails.send({
      from: ENV.emailFrom,
      to: data.vendorEmail,
      subject: `💼 New Order #${data.orderNumber} — Commission ${parseFloat(String(data.commissionTotal)).toFixed(3)} ${currency} | Cove Interior`,
      html: emailWrapper(body),
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send vendor order notification:", err);
    return false;
  }
}
