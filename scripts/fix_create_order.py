import re

content = open('/home/ubuntu/cove-storefront/server/db.ts').read()

# Remove the broken createOrder function (from "export async function createOrder" to the end)
idx = content.find('\nexport async function createOrder(')
if idx == -1:
    print("createOrder not found!")
    exit(1)

# Find the closing brace of createOrder
# Count braces from the function start
func_start = idx
brace_count = 0
i = func_start
found_first = False
while i < len(content):
    if content[i] == '{':
        brace_count += 1
        found_first = True
    elif content[i] == '}':
        brace_count -= 1
        if found_first and brace_count == 0:
            func_end = i + 1
            break
    i += 1

# Replace with corrected version
new_func = '''
export async function createOrder(opts: {
  customerId?: number;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  channel: 'online' | 'pos';
  status: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  billingAddress?: any;
  shippingAddress?: any;
  notes?: string;
  items: Array<{
    productId: number;
    variantId?: number;
    name: string;
    sku?: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const { orders, orderItems, warehouseStock, warehouses } = await import('../drizzle/schema');
  const { eq, and } = await import('drizzle-orm');

  const orderNumber = `CVE-${Date.now().toString(36).toUpperCase()}`;
  const addr = opts.shippingAddress || opts.billingAddress || {};

  const [inserted] = await db.insert(orders).values({
    orderNumber,
    customerId: opts.customerId || null,
    customerEmail: opts.guestEmail || null,
    customerName: opts.guestName || null,
    customerPhone: opts.guestPhone || null,
    channel: opts.channel as any,
    status: opts.status as any,
    currency: opts.currency,
    subtotal: String(opts.subtotal),
    discountAmount: String(opts.discountTotal),
    shippingCost: String(opts.shippingTotal),
    total: String(opts.total),
    couponCode: opts.couponCode || null,
    shippingMethod: opts.shippingMethod || null,
    paymentMethod: opts.paymentMethod || null,
    shippingCountry: addr.country || 'KW',
    shippingArea: addr.city || addr.area || null,
    shippingBlock: addr.block || null,
    shippingStreet: addr.street || null,
    shippingAvenue: addr.avenue || null,
    shippingHouse: addr.house || addr.building || null,
    shippingPaci: addr.paci || null,
    shippingNotes: opts.notes || addr.notes || null,
  });

  const orderId = (inserted as any).insertId;

  if (opts.items.length > 0) {
    await db.insert(orderItems).values(opts.items.map(item => ({
      orderId,
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.name,
      sku: item.sku || null,
      quantity: item.quantity,
      unitPrice: String(item.price),
      totalPrice: String(item.total),
    })));
  }

  // Deduct from online warehouse stock
  const onlineWarehouse = await db.select().from(warehouses).where(eq(warehouses.type, 'online')).limit(1);
  if (onlineWarehouse[0]) {
    for (const item of opts.items) {
      const stockRows = await db.select().from(warehouseStock).where(
        and(eq(warehouseStock.warehouseId, onlineWarehouse[0].id), eq(warehouseStock.productId, item.productId))
      ).limit(1);
      if (stockRows[0]) {
        const newQty = Math.max(0, (stockRows[0].quantity || 0) - item.quantity);
        await db.update(warehouseStock).set({ quantity: newQty }).where(eq(warehouseStock.id, stockRows[0].id));
      }
    }
  }

  return { orderId, orderNumber };
}'''

new_content = content[:func_start] + new_func + content[func_end:]
open('/home/ubuntu/cove-storefront/server/db.ts', 'w').write(new_content)
print('createOrder fixed in db.ts')
print('Total lines:', len(new_content.splitlines()))
