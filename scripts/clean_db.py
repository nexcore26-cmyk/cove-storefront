content = open('/home/ubuntu/cove-storefront/server/db.ts').read()

# Find the first occurrence of createOrder
marker = '\nexport async function createOrder('
idx = content.find(marker)
if idx == -1:
    print("createOrder not found, nothing to clean")
    exit(0)

# Keep everything before the first createOrder
before = content[:idx]

# The new clean createOrder function
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
}
'''

new_content = before + new_func
open('/home/ubuntu/cove-storefront/server/db.ts', 'w').write(new_content)
print('db.ts cleaned. Lines:', len(new_content.splitlines()))
