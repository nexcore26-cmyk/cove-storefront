/**
 * Standalone WooCommerce sync runner — uses actual DB column names
 * Usage: node scripts/run-sync.mjs main
 *        node scripts/run-sync.mjs brass
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const source = process.argv[2] || 'main';
if (!['main', 'brass'].includes(source)) {
  console.error('Usage: node scripts/run-sync.mjs [main|brass]');
  process.exit(1);
}

const WC_CONFIG = {
  main: {
    url: process.env.WC_MAIN_URL || 'https://coveinterior.com',
    key: process.env.WC_MAIN_KEY || 'ck_6fa18cdd12cc966233075314818a70183857b0c0',
    secret: process.env.WC_MAIN_SECRET || 'cs_993948466557deae24f0183a7f4cd88ffd4fb3ef',
  },
  brass: {
    url: process.env.WC_BRASS_URL || 'https://brass.coveinterior.com',
    key: process.env.WC_BRASS_KEY || 'ck_c1359c4bf656e993085fd9290a69fd1281b39555',
    secret: process.env.WC_BRASS_SECRET || 'cs_3b29bbaf4ba73012a2207d878521e142c766fc7a',
  },
};

const cfg = WC_CONFIG[source];
const DB_URL = process.env.DATABASE_URL;

async function wcFetch(endpoint, params = {}, retries = 3) {
  const url = new URL(`${cfg.url}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set('consumer_key', cfg.key);
  url.searchParams.set('consumer_secret', cfg.secret);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`WC API error ${res.status}: ${endpoint}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      console.warn(`  ⚠ Retry ${attempt}/${retries} for ${endpoint}: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

async function wcFetchAll(endpoint, params = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const data = await wcFetch(endpoint, { ...params, per_page: 100, page });
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    console.log(`  Fetched page ${page} of ${endpoint}: ${data.length} items (total: ${results.length})`);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

function detectChannel(name) {
  const lower = name.toLowerCase();
  const hasWeb = lower.includes('web');
  const hasStore = lower.includes('store');
  if (hasWeb && hasStore) return 'both';
  if (hasWeb) return 'online';
  if (hasStore) return 'pos';
  return 'none';
}

function mapOrderStatus(wcStatus) {
  const map = {
    'pending': 'pending', 'processing': 'processing', 'on-hold': 'on_hold',
    'completed': 'completed', 'cancelled': 'cancelled', 'refunded': 'refunded',
    'failed': 'failed', 'shipped': 'shipped', 'delivered': 'delivered',
  };
  return map[wcStatus] || 'pending';
}

function mapCouponType(wcType) {
  const map = { 'percent': 'percent', 'fixed_cart': 'fixed_cart', 'fixed_product': 'fixed_product' };
  return map[wcType] || 'percent';
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log(`\n🔄 Starting full sync for: ${source} (${cfg.url})\n`);

  // Mark stale running logs as failed
  await conn.execute(
    `UPDATE sync_logs SET status = 'failed', errorLog = '["Interrupted by new sync run"]', completedAt = NOW() WHERE status = 'running' AND source = ?`,
    [source]
  );

  // Create new sync log
  const [logInsert] = await conn.execute(
    `INSERT INTO sync_logs (source, type, status, triggeredBy) VALUES (?, 'full', 'running', 1)`,
    [source]
  );
  const logId = logInsert.insertId;
  console.log(`📋 Sync log ID: ${logId}\n`);

  const result = { categories: 0, products: 0, customers: 0, orders: 0, coupons: 0, shippingZones: 0, errors: [] };

  // ── 1. CATEGORIES ────────────────────────────────────────────────────────
  console.log('📁 Syncing categories...');
  try {
    const wcCats = await wcFetchAll('products/categories', { hide_empty: 0 });
    for (const cat of wcCats) {
      const channel = detectChannel(cat.name);
      await conn.execute(
        `INSERT INTO categories (wcId, wcSource, name, slug, parentId, description, image, channel, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), slug=VALUES(slug), description=VALUES(description), image=VALUES(image), channel=VALUES(channel)`,
        [cat.id, source, cat.name, `${source}-${cat.slug}`, cat.parent || null, cat.description || null, cat.image?.src || null, channel]
      );
      result.categories++;
    }
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories, logId]);
    console.log(`  ✅ ${result.categories} categories synced\n`);
  } catch (e) {
    result.errors.push(`categories: ${e.message}`);
    console.error(`  ❌ Categories error: ${e.message}\n`);
  }

  // ── 2. PRODUCTS ──────────────────────────────────────────────────────────
  console.log('📦 Syncing products...');
  try {
    const wcProds = await wcFetchAll('products', { status: 'publish' });

    // Get warehouses
    const [warehouses] = await conn.execute('SELECT id, name FROM warehouses');
    const mainWh = warehouses.find(w => w.name === 'Main Warehouse');
    const onlineWh = warehouses.find(w => w.name === 'Online Store');
    const posWh = warehouses.find(w => w.name === 'POS / Brass Store');

    for (const p of wcProds) {
      // Determine channel from categories
      let isOnline = false, isPos = false;
      if (p.categories && p.categories.length > 0) {
        const catIds = p.categories.map(c => c.id);
        const placeholders = catIds.map(() => '?').join(',');
        const [catRows] = await conn.execute(
          `SELECT channel FROM categories WHERE wcId IN (${placeholders}) AND wcSource = ?`,
          [...catIds, source]
        );
        const channels = catRows.map(r => r.channel);
        isOnline = channels.some(c => c === 'online' || c === 'both');
        isPos = channels.some(c => c === 'pos' || c === 'both');
      }

      // Get category ID from our DB
      let categoryId = null;
      if (p.categories && p.categories.length > 0) {
        const [catRow] = await conn.execute(
          `SELECT id FROM categories WHERE wcId = ? AND wcSource = ? LIMIT 1`,
          [p.categories[0].id, source]
        );
        if (catRow.length > 0) categoryId = catRow[0].id;
      }

      const stock = p.stock_quantity || 0;
      const price = parseFloat(p.price || p.regular_price || '0') || 0;
      const salePrice = p.sale_price ? parseFloat(p.sale_price) : null;
      const cog = parseFloat(p.meta_data?.find(m => ['_cog', 'cog', '_cost', 'cost'].includes(m.key))?.value || '0') || null;
      const productType = p.type === 'variable' ? 'variable' : p.type === 'grouped' ? 'grouped' : 'simple';
      const status = p.status === 'publish' ? 'active' : 'draft';

      await conn.execute(
        `INSERT INTO products (wcId, wcSource, name, slug, description, shortDescription, sku, price, salePrice, cog, images, categoryId, type, status, isFeatured, wcRawData, lastSyncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), slug=VALUES(slug), description=VALUES(description), shortDescription=VALUES(shortDescription),
           sku=VALUES(sku), price=VALUES(price), salePrice=VALUES(salePrice), cog=VALUES(cog),
           images=VALUES(images), categoryId=VALUES(categoryId), type=VALUES(type), status=VALUES(status),
           isFeatured=VALUES(isFeatured), lastSyncedAt=NOW()`,
        [
          p.id, source, p.name, p.slug,
          p.description || null, p.short_description || null,
          p.sku || null, price, salePrice, cog,
          JSON.stringify(p.images?.map(i => i.src) || []),
          categoryId, productType, status,
          p.featured ? 1 : 0,
          JSON.stringify({ stock_quantity: stock, stock_status: p.stock_status, attributes: p.attributes }),
        ]
      );

      // Get inserted product ID
      const [prodRow] = await conn.execute(
        `SELECT id FROM products WHERE wcId = ? AND wcSource = ? LIMIT 1`,
        [p.id, source]
      );
      if (prodRow.length === 0) continue;
      const productId = prodRow[0].id;

      // Upsert warehouse stock
      if (mainWh) {
        await conn.execute(
          `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
          [mainWh.id, productId, stock]
        );
      }
      if (onlineWh && isOnline) {
        await conn.execute(
          `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity`,
          [onlineWh.id, productId, 0]
        );
      }
      if (posWh && isPos) {
        await conn.execute(
          `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity`,
          [posWh.id, productId, 0]
        );
      }

      // Sync variants if variable product
      if (p.type === 'variable') {
        try {
          const variants = await wcFetch(`products/${p.id}/variations`, { per_page: 100 });
          for (const v of variants) {
            const vPrice = parseFloat(v.price || v.regular_price || '0') || 0;
            const vSalePrice = v.sale_price ? parseFloat(v.sale_price) : null;
            await conn.execute(
              `INSERT INTO product_variants (productId, wcVariantId, sku, price, salePrice, attributes, image, isActive)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)
               ON DUPLICATE KEY UPDATE
                 sku=VALUES(sku), price=VALUES(price), salePrice=VALUES(salePrice),
                 attributes=VALUES(attributes), image=VALUES(image)`,
              [
                productId, v.id, v.sku || null,
                vPrice, vSalePrice,
                JSON.stringify(v.attributes || []),
                v.image?.src || null,
              ]
            );
          }
        } catch (ve) {
          console.warn(`  ⚠ Variants error for product ${p.id}: ${ve.message}`);
        }
      }

      result.products++;
      if (result.products % 20 === 0) {
        await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products, logId]);
        console.log(`  Progress: ${result.products}/${wcProds.length} products`);
      }
    }
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products, logId]);
    console.log(`  ✅ ${result.products} products synced\n`);
  } catch (e) {
    result.errors.push(`products: ${e.message}`);
    console.error(`  ❌ Products error: ${e.message}\n`);
  }

  // ── 3. CUSTOMERS ─────────────────────────────────────────────────────────
  console.log('👤 Syncing customers...');
  try {
    const wcCustomers = await wcFetchAll('customers');
    for (const c of wcCustomers) {
      await conn.execute(
        `INSERT INTO customers (wcCustomerId, wcSource, email, firstName, lastName, phone, country, area)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           email=VALUES(email), firstName=VALUES(firstName), lastName=VALUES(lastName),
           phone=VALUES(phone), country=VALUES(country), area=VALUES(area)`,
        [
          c.id, source,
          c.email || null,
          c.first_name || null,
          c.last_name || null,
          c.billing?.phone || null,
          c.billing?.country || null,
          c.billing?.city || null,
        ]
      );
      result.customers++;
    }
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products + result.customers, logId]);
    console.log(`  ✅ ${result.customers} customers synced\n`);
  } catch (e) {
    result.errors.push(`customers: ${e.message}`);
    console.error(`  ❌ Customers error: ${e.message}\n`);
  }

  // ── 4. ORDERS ────────────────────────────────────────────────────────────
  console.log('🛒 Syncing orders...');
  try {
    const wcOrders = await wcFetchAll('orders');
    for (const o of wcOrders) {
      const status = mapOrderStatus(o.status);
      const paymentStatus = (o.status === 'completed' || o.status === 'processing') ? 'paid' : 'pending';

      // Find customer
      let customerId = null;
      if (o.customer_id) {
        const [custRow] = await conn.execute(
          `SELECT id FROM customers WHERE wcCustomerId = ? AND wcSource = ? LIMIT 1`,
          [o.customer_id, source]
        );
        if (custRow.length > 0) customerId = custRow[0].id;
      }

      const customerName = [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ') || null;

      await conn.execute(
        `INSERT INTO orders (wcOrderId, wcSource, orderNumber, customerId, customerName, customerEmail, customerPhone,
           shippingCountry, shippingArea, shippingBlock, shippingStreet, shippingHouse,
           subtotal, shippingCost, discountAmount, total, currency,
           couponCode, status, paymentMethod, paymentStatus, channel, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?)
         ON DUPLICATE KEY UPDATE orderNumber=VALUES(orderNumber), status=VALUES(status), paymentStatus=VALUES(paymentStatus), total=VALUES(total), customerName=VALUES(customerName), customerEmail=VALUES(customerEmail)`,
        [
          o.id, source, `${source.toUpperCase()}-${o.id}`, customerId,
          customerName,
          o.billing?.email || null,
          o.billing?.phone || null,
          o.shipping?.country || o.billing?.country || null,
          o.shipping?.city || o.billing?.city || null,
          o.shipping?.address_1 || o.billing?.address_1 || null,
          o.shipping?.address_2 || o.billing?.address_2 || null,
          o.shipping?.postcode || o.billing?.postcode || null,
          parseFloat(o.subtotal || '0'),
          parseFloat(o.shipping_total || '0'),
          parseFloat(o.discount_total || '0'),
          parseFloat(o.total || '0'),
          o.currency || 'KWD',
          o.coupon_lines?.[0]?.code || null,
          status, o.payment_method || null, paymentStatus,
          new Date(o.date_created || Date.now()),
        ]
      );

      // Get order ID and insert line items
      const [orderRow] = await conn.execute(
        `SELECT id FROM orders WHERE wcOrderId = ? AND wcSource = ? LIMIT 1`,
        [o.id, source]
      );
      if (orderRow.length > 0) {
        const orderId = orderRow[0].id;
        for (const item of (o.line_items || [])) {
          const [prodRow] = await conn.execute(
            `SELECT id FROM products WHERE wcId = ? AND wcSource = ? LIMIT 1`,
            [item.product_id, source]
          );
          const productId = prodRow.length > 0 ? prodRow[0].id : null;
          await conn.execute(
            `INSERT IGNORE INTO order_items (orderId, productId, wcProductId, name, sku, quantity, unitPrice, totalPrice)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, productId, item.product_id, item.name, item.sku || null, item.quantity, parseFloat(item.price || '0'), parseFloat(item.total || '0')]
          );
        }
      }
      result.orders++;
      if (result.orders % 50 === 0) {
        console.log(`  Progress: ${result.orders} orders`);
      }
    }
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products + result.customers + result.orders, logId]);
    console.log(`  ✅ ${result.orders} orders synced\n`);
  } catch (e) {
    result.errors.push(`orders: ${e.message}`);
    console.error(`  ❌ Orders error: ${e.message}\n`);
  }

  // ── 5. COUPONS ───────────────────────────────────────────────────────────
  console.log('🎟 Syncing coupons...');
  try {
    const wcCoupons = await wcFetchAll('coupons');
    for (const c of wcCoupons) {
      const couponType = mapCouponType(c.discount_type);
      await conn.execute(
        `INSERT INTO coupons (wcId, wcSource, code, type, amount, minimumAmount, maximumAmount, usageLimit, usageCount, expiryDate, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           code=VALUES(code), type=VALUES(type), amount=VALUES(amount), usageCount=VALUES(usageCount), isActive=VALUES(isActive)`,
        [
          c.id, source, c.code, couponType,
          parseFloat(c.amount || '0'),
          c.minimum_amount ? parseFloat(c.minimum_amount) : null,
          c.maximum_amount ? parseFloat(c.maximum_amount) : null,
          c.usage_limit || null,
          c.usage_count || 0,
          c.date_expires ? new Date(c.date_expires) : null,
        ]
      );
      result.coupons++;
    }
    console.log(`  ✅ ${result.coupons} coupons synced\n`);
  } catch (e) {
    result.errors.push(`coupons: ${e.message}`);
    console.error(`  ❌ Coupons error: ${e.message}\n`);
  }

  // ── 6. SHIPPING ZONES ────────────────────────────────────────────────────
  console.log('🚚 Syncing shipping zones...');
  try {
    const zones = await wcFetch('shipping/zones');
    for (const zone of zones) {
      let locations = [], methods = [];
      try {
        locations = await wcFetch(`shipping/zones/${zone.id}/locations`);
        methods = await wcFetch(`shipping/zones/${zone.id}/methods`);
      } catch (e) {
        console.warn(`  ⚠ Zone ${zone.id} details: ${e.message}`);
      }
      const countries = locations.filter(l => l.type === 'country').map(l => l.code);
      const methodData = methods.map(m => ({
        id: String(m.instance_id), title: m.title || m.method_title,
        type: m.method_id, cost: m.settings?.cost?.value,
        freeShippingMinAmount: m.settings?.min_amount?.value, enabled: m.enabled,
      }));
      await conn.execute(
        `INSERT INTO shipping_zones (wcZoneId, name, countries, methods, isActive)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), countries=VALUES(countries), methods=VALUES(methods)`,
        [zone.id, zone.name, JSON.stringify(countries), JSON.stringify(methodData)]
      );
      result.shippingZones++;
    }
    console.log(`  ✅ ${result.shippingZones} shipping zones synced\n`);
  } catch (e) {
    result.errors.push(`shippingZones: ${e.message}`);
    console.error(`  ❌ Shipping zones error: ${e.message}\n`);
  }

  // ── FINALIZE ─────────────────────────────────────────────────────────────
  const totalSynced = result.categories + result.products + result.customers + result.orders + result.coupons + result.shippingZones;
  await conn.execute(
    `UPDATE sync_logs SET status = 'completed', itemsSynced = ?, itemsFailed = ?, errorLog = ?, completedAt = NOW() WHERE id = ?`,
    [totalSynced, result.errors.length, JSON.stringify(result.errors), logId]
  );
  await conn.end();

  console.log('\n🎉 Sync complete!');
  console.log(`   Categories: ${result.categories}`);
  console.log(`   Products:   ${result.products}`);
  console.log(`   Customers:  ${result.customers}`);
  console.log(`   Orders:     ${result.orders}`);
  console.log(`   Coupons:    ${result.coupons}`);
  console.log(`   Shipping:   ${result.shippingZones}`);
  if (result.errors.length > 0) {
    console.log(`\n⚠ Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.log(`   - ${e}`));
  }
}

main().catch(e => {
  console.error('Fatal sync error:', e);
  process.exit(1);
});
