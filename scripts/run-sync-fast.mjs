/**
 * Fast WooCommerce sync — batch inserts, pre-loaded maps, correct column names
 * Usage: node scripts/run-sync-fast.mjs [main|brass]
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const source = process.argv[2] || 'main';
if (!['main', 'brass'].includes(source)) {
  console.error('Usage: node scripts/run-sync-fast.mjs [main|brass]');
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

async function wcFetch(endpoint, params = {}, retries = 3) {
  const url = new URL(`${cfg.url}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set('consumer_key', cfg.key);
  url.searchParams.set('consumer_secret', cfg.secret);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`WC API ${res.status}: ${endpoint}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) throw e;
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
    console.log(`  Page ${page}: ${data.length} ${endpoint} (total: ${results.length})`);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

function detectChannel(name) {
  const lower = name.toLowerCase();
  if (lower.includes('web') && lower.includes('store')) return 'both';
  if (lower.includes('web')) return 'online';
  if (lower.includes('store')) return 'pos';
  return 'none';
}

function mapOrderStatus(s) {
  const map = { pending: 'pending', processing: 'processing', 'on-hold': 'on-hold', completed: 'completed', cancelled: 'cancelled', refunded: 'refunded', failed: 'failed', trash: 'cancelled' };
  return map[s] || 'pending';
}

function mapCouponType(t) {
  if (t === 'percent') return 'percent';
  if (t === 'fixed_cart') return 'fixed_cart';
  if (t === 'fixed_product') return 'fixed_product';
  return 'fixed_cart';
}

async function batchInsert(conn, table, columns, rows, onDupSql = '') {
  if (rows.length === 0) return;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const values = chunk.flat();
    await conn.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders} ${onDupSql}`, values);
  }
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log(`\n🔄 Fast sync: ${source.toUpperCase()} store\n`);

  // Create sync log
  const [logRes] = await conn.execute(
    `INSERT INTO sync_logs (source, type, status, itemsSynced, itemsFailed, errorLog) VALUES (?, 'full', 'running', 0, 0, '[]')`,
    [source]
  );
  const logId = logRes.insertId;

  // Get warehouse IDs using 'type' column
  const [whs] = await conn.execute(`SELECT id, type FROM warehouses`);
  const mainWh = whs.find(w => w.type === 'main');
  const onlineWh = whs.find(w => w.type === 'online');
  const posWh = whs.find(w => w.type === 'pos');

  const result = { categories: 0, products: 0, customers: 0, orders: 0, coupons: 0, errors: [] };

  // ── 1. CATEGORIES ─────────────────────────────────────────────────────────
  // DB columns: id, wcId, wcSource, name, nameAr, slug, parentId, description, image, channel, displayOrder, isActive
  console.log('📂 Syncing categories...');
  try {
    const wcCats = await wcFetchAll('products/categories');
    const catRows = wcCats.map(c => [
      c.id, source, c.name, c.slug,
      c.description || null,
      c.image?.src || null,
      null, // parentId - set after
      detectChannel(c.name),
      1, c.menu_order || 0,
    ]);
    await batchInsert(conn, 'categories',
      ['wcId','wcSource','name','slug','description','image','parentId','channel','isActive','displayOrder'],
      catRows,
      `ON DUPLICATE KEY UPDATE name=VALUES(name), slug=VALUES(slug), description=VALUES(description),
       image=VALUES(image), channel=VALUES(channel), displayOrder=VALUES(displayOrder)`
    );
    // Fix parentId references
    const [allCats] = await conn.execute(`SELECT id, wcId FROM categories WHERE wcSource = ?`, [source]);
    const wcToId = Object.fromEntries(allCats.map(c => [c.wcId, c.id]));
    for (const c of wcCats) {
      if (c.parent && wcToId[c.parent]) {
        await conn.execute(`UPDATE categories SET parentId = ? WHERE wcId = ? AND wcSource = ?`, [wcToId[c.parent], c.id, source]);
      }
    }
    result.categories = wcCats.length;
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories, logId]);
    console.log(`  ✅ ${result.categories} categories\n`);
  } catch (e) {
    result.errors.push(`categories: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── 2. PRODUCTS ───────────────────────────────────────────────────────────
  // DB columns: id, wcId, wcSource, name, nameAr, slug, sku, description, shortDescription,
  //             price, salePrice, cog, currency, images, categoryId, tags, status, type,
  //             isFeatured, isNew, weight, dimensionsJson, wcRawData, lastSyncedAt
  console.log('📦 Syncing products...');
  try {
    const wcProds = await wcFetchAll('products');
    const [allCats] = await conn.execute(`SELECT id, wcId FROM categories WHERE wcSource = ?`, [source]);
    const wcCatToId = Object.fromEntries(allCats.map(c => [c.wcId, c.id]));

    for (const p of wcProds) {
      const price = parseFloat(p.price || p.regular_price || '0') || 0;
      const salePrice = p.sale_price ? parseFloat(p.sale_price) : null;
      const stock = p.stock_quantity || 0;
      const catIds = (p.categories || []).map(c => wcCatToId[c.id]).filter(Boolean);
      const categoryId = catIds[0] || null;
      const isOnline = (p.categories || []).some(c => c.name.toLowerCase().includes('web'));
      const isPos = (p.categories || []).some(c => c.name.toLowerCase().includes('store'));

      await conn.execute(
        `INSERT INTO products (wcId, wcSource, name, slug, sku, description, shortDescription,
           price, salePrice, cog, currency, categoryId, images, tags, type, status, isFeatured, isNew, lastSyncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'KWD', ?, ?, ?, ?, 'active', ?, 0, NOW())
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), slug=VALUES(slug), price=VALUES(price), salePrice=VALUES(salePrice),
           images=VALUES(images), status=VALUES(status), lastSyncedAt=NOW()`,
        [
          p.id, source, p.name, p.slug, p.sku || null,
          p.description || null, p.short_description || null,
          price, salePrice, null, categoryId,
          JSON.stringify((p.images || []).map(i => i.src)),
          JSON.stringify((p.tags || []).map(t => t.name)),
          p.type || 'simple', p.featured || false,
        ]
      );

      const [prodRow] = await conn.execute(`SELECT id FROM products WHERE wcId = ? AND wcSource = ? LIMIT 1`, [p.id, source]);
      if (prodRow.length === 0) continue;
      const productId = prodRow[0].id;

      // Warehouse stock — warehouse_stock columns: id, warehouseId, productId, variantId, quantity, reservedQty, reorderPoint
      if (mainWh) await conn.execute(
        `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)`,
        [mainWh.id, productId, stock]
      );
      if (onlineWh && isOnline) await conn.execute(
        `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity=quantity`,
        [onlineWh.id, productId, 0]
      );
      if (posWh && isPos) await conn.execute(
        `INSERT INTO warehouse_stock (warehouseId, productId, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity=quantity`,
        [posWh.id, productId, 0]
      );

      // Variants — product_variants columns: id, productId, wcVariantId, sku, name, attributes, price, salePrice, cog, image, weight, isActive
      if (p.type === 'variable') {
        try {
          const variants = await wcFetch(`products/${p.id}/variations`, { per_page: 100 });
          for (const v of variants) {
            const variantName = (v.attributes || []).map(a => a.option).join(' / ') || null;
            await conn.execute(
              `INSERT INTO product_variants (productId, wcVariantId, sku, name, attributes, price, salePrice, image, isActive)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
               ON DUPLICATE KEY UPDATE sku=VALUES(sku), name=VALUES(name), price=VALUES(price), salePrice=VALUES(salePrice), attributes=VALUES(attributes), image=VALUES(image)`,
              [productId, v.id, v.sku || null, variantName, JSON.stringify(v.attributes || []), parseFloat(v.price || v.regular_price || '0') || 0, v.sale_price ? parseFloat(v.sale_price) : null, v.image?.src || null]
            );
          }
        } catch (ve) { console.warn(`  ⚠ Variants for ${p.id}: ${ve.message}`); }
      }

      result.products++;
      if (result.products % 20 === 0) console.log(`  Progress: ${result.products}/${wcProds.length} products`);
    }
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products, logId]);
    console.log(`  ✅ ${result.products} products\n`);
  } catch (e) {
    result.errors.push(`products: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── 3. CUSTOMERS ─────────────────────────────────────────────────────────
  // DB columns: id, userId, wcCustomerId, wcSource, firstName, lastName, email, phone, country, area, block, street, avenue, house, paci, notes, totalOrders, totalSpent
  console.log('👤 Syncing customers...');
  try {
    const wcCustomers = await wcFetchAll('customers');
    const custRows = wcCustomers.map(c => [
      null, // userId
      c.id, source,
      c.first_name || null, c.last_name || null,
      c.email || null,
      c.billing?.phone || null,
      c.billing?.country || null,
      c.billing?.city || null,
      c.billing?.address_1 || null,
      c.billing?.address_2 || null,
      null, // avenue
      null, // house
      null, // paci
      null, // notes
      c.orders_count || 0,
      parseFloat(c.total_spent || '0'),
    ]);
    await batchInsert(conn, 'customers',
      ['userId','wcCustomerId','wcSource','firstName','lastName','email','phone','country','area','block','street','avenue','house','paci','notes','totalOrders','totalSpent'],
      custRows,
      `ON DUPLICATE KEY UPDATE firstName=VALUES(firstName), lastName=VALUES(lastName), email=VALUES(email), phone=VALUES(phone), country=VALUES(country), area=VALUES(area), totalOrders=VALUES(totalOrders), totalSpent=VALUES(totalSpent)`
    );
    result.customers = wcCustomers.length;
    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products + result.customers, logId]);
    console.log(`  ✅ ${result.customers} customers\n`);
  } catch (e) {
    result.errors.push(`customers: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── 4. ORDERS ─────────────────────────────────────────────────────────────
  // DB columns: id, orderNumber, wcOrderId, wcSource, customerId, customerName, customerEmail, customerPhone,
  //   shippingCountry, shippingArea, shippingBlock, shippingStreet, shippingAvenue, shippingHouse, shippingPaci, shippingNotes,
  //   subtotal, shippingCost, discountAmount, total, currency, couponCode, status, paymentMethod, paymentStatus,
  //   paymentReference, shippingMethod, trackingNumber, channel, paidAt, shippedAt, deliveredAt, createdAt
  console.log('🛒 Syncing orders...');
  try {
    const wcOrders = await wcFetchAll('orders');

    // Pre-load maps
    const [custRows] = await conn.execute(`SELECT id, wcCustomerId FROM customers WHERE wcSource = ?`, [source]);
    const wcCustToId = Object.fromEntries(custRows.map(c => [c.wcCustomerId, c.id]));
    const [prodRows] = await conn.execute(`SELECT id, wcId FROM products WHERE wcSource = ?`, [source]);
    const wcProdToId = Object.fromEntries(prodRows.map(p => [p.wcId, p.id]));

    const BATCH = 50;
    for (let i = 0; i < wcOrders.length; i += BATCH) {
      const batch = wcOrders.slice(i, i + BATCH);

      for (const o of batch) {
        const status = mapOrderStatus(o.status);
        const paymentStatus = (o.status === 'completed' || o.status === 'processing') ? 'paid' : 'pending';
        const customerId = o.customer_id ? (wcCustToId[o.customer_id] || null) : null;
        const customerName = [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ') || null;

        await conn.execute(
          `INSERT INTO orders (wcOrderId, wcSource, orderNumber, customerId, customerName, customerEmail, customerPhone,
             shippingCountry, shippingArea, shippingBlock, shippingStreet, shippingAvenue, shippingHouse,
             subtotal, shippingCost, discountAmount, total, currency,
             couponCode, status, paymentMethod, paymentStatus, channel, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?)
           ON DUPLICATE KEY UPDATE orderNumber=VALUES(orderNumber), status=VALUES(status),
             paymentStatus=VALUES(paymentStatus), total=VALUES(total),
             customerName=VALUES(customerName), customerEmail=VALUES(customerEmail)`,
          [
            o.id, source, `${source.toUpperCase()}-${o.id}`, customerId,
            customerName,
            o.billing?.email || null,
            o.billing?.phone || null,
            (o.shipping?.country || o.billing?.country || '').substring(0, 10) || null,
            (o.shipping?.city || o.billing?.city || null),
            (o.shipping?.address_1 || o.billing?.address_1 || null),
            (o.shipping?.address_2 || o.billing?.address_2 || null),
            null, // avenue
            null, // house
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
      }

      // Get order IDs for this batch
      const wcIds = batch.map(o => o.id);
      const [orderRows] = await conn.execute(
        `SELECT id, wcOrderId FROM orders WHERE wcOrderId IN (${wcIds.map(() => '?').join(',')}) AND wcSource = ?`,
        [...wcIds, source]
      );
      const wcOrderToId = Object.fromEntries(orderRows.map(r => [r.wcOrderId, r.id]));

      // Batch insert line items
      // order_items columns: id, orderId, productId, variantId, wcProductId, name, sku, image, quantity, unitPrice, totalPrice, cog, variantAttributes
      const itemRows = [];
      for (const o of batch) {
        const orderId = wcOrderToId[o.id];
        if (!orderId) continue;
        for (const item of (o.line_items || [])) {
          itemRows.push([
            orderId,
            wcProdToId[item.product_id] || null,
            null, // variantId
            item.product_id,
            item.name,
            item.sku || null,
            item.image?.src || null,
            item.quantity,
            parseFloat(item.price || '0'),
            parseFloat(item.total || '0'),
            null, // cog
            JSON.stringify(item.meta_data || []),
          ]);
        }
      }
      if (itemRows.length > 0) {
        await batchInsert(conn, 'order_items',
          ['orderId','productId','variantId','wcProductId','name','sku','image','quantity','unitPrice','totalPrice','cog','variantAttributes'],
          itemRows,
          'ON DUPLICATE KEY UPDATE name=VALUES(name), totalPrice=VALUES(totalPrice)'
        );
      }

      result.orders += batch.length;
      console.log(`  Progress: ${result.orders}/${wcOrders.length} orders`);
    }

    await conn.execute(`UPDATE sync_logs SET itemsSynced = ? WHERE id = ?`, [result.categories + result.products + result.customers + result.orders, logId]);
    console.log(`  ✅ ${result.orders} orders\n`);
  } catch (e) {
    result.errors.push(`orders: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── 5. COUPONS ───────────────────────────────────────────────────────────
  // DB columns: id, wcId, wcSource, code, description, type, amount, minimumAmount, maximumAmount, usageLimit, usageCount, usageLimitPerUser, individualUse, freeShipping, expiryDate, isActive
  console.log('🎟 Syncing coupons...');
  try {
    const wcCoupons = await wcFetchAll('coupons');
    const couponRows = wcCoupons.map(c => [
      c.id, source, c.code,
      c.description || null,
      mapCouponType(c.discount_type),
      parseFloat(c.amount || '0'),
      c.minimum_amount ? parseFloat(c.minimum_amount) : null,
      c.maximum_amount ? parseFloat(c.maximum_amount) : null,
      c.usage_limit || null,
      c.usage_count || 0,
      c.usage_limit_per_user || null,
      c.individual_use ? 1 : 0,
      c.free_shipping ? 1 : 0,
      c.date_expires ? new Date(c.date_expires) : null,
      1,
    ]);
    await batchInsert(conn, 'coupons',
      ['wcId','wcSource','code','description','type','amount','minimumAmount','maximumAmount','usageLimit','usageCount','usageLimitPerUser','individualUse','freeShipping','expiryDate','isActive'],
      couponRows,
      `ON DUPLICATE KEY UPDATE code=VALUES(code), type=VALUES(type), amount=VALUES(amount), usageCount=VALUES(usageCount), isActive=VALUES(isActive)`
    );
    result.coupons = wcCoupons.length;
    console.log(`  ✅ ${result.coupons} coupons\n`);
  } catch (e) {
    result.errors.push(`coupons: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── 6. SHIPPING ZONES ────────────────────────────────────────────────────
  // DB columns: id, wcZoneId, name, countries, methods, isActive
  console.log('🚚 Syncing shipping zones...');
  try {
    const zones = await wcFetch('shipping/zones');
    for (const zone of zones) {
      let locations = [], methods = [];
      try {
        locations = await wcFetch(`shipping/zones/${zone.id}/locations`);
        methods = await wcFetch(`shipping/zones/${zone.id}/methods`);
      } catch (e) { console.warn(`  ⚠ Zone ${zone.id}: ${e.message}`); }
      const countries = locations.filter(l => l.type === 'country').map(l => l.code);
      const methodData = methods.map(m => ({
        id: String(m.instance_id), title: m.title || m.method_title,
        cost: m.settings?.cost?.value || '0', type: m.method_id,
      }));
      await conn.execute(
        `INSERT INTO shipping_zones (wcZoneId, name, countries, methods, isActive)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), countries=VALUES(countries), methods=VALUES(methods)`,
        [zone.id, zone.name, JSON.stringify(countries), JSON.stringify(methodData)]
      );
    }
    console.log(`  ✅ ${zones.length} shipping zones\n`);
  } catch (e) {
    result.errors.push(`shipping: ${e.message}`);
    console.error(`  ❌ ${e.message}\n`);
  }

  // ── FINALIZE ─────────────────────────────────────────────────────────────
  const totalItems = result.categories + result.products + result.customers + result.orders + result.coupons;
  await conn.execute(
    `UPDATE sync_logs SET status = ?, itemsSynced = ?, itemsFailed = ?, errorLog = ?, completedAt = NOW() WHERE id = ?`,
    [result.errors.length > 0 ? 'failed' : 'completed', totalItems, result.errors.length, JSON.stringify(result.errors), logId]
  );

  console.log('═══════════════════════════════════════');
  console.log(`✅ SYNC COMPLETE (${source.toUpperCase()})`);
  console.log(`   Categories : ${result.categories}`);
  console.log(`   Products   : ${result.products}`);
  console.log(`   Customers  : ${result.customers}`);
  console.log(`   Orders     : ${result.orders}`);
  console.log(`   Coupons    : ${result.coupons}`);
  if (result.errors.length > 0) console.log(`   Errors     : ${result.errors.join(', ')}`);
  console.log('═══════════════════════════════════════\n');

  await conn.end();
}

main().catch(e => {
  console.error('Fatal sync error:', e);
  process.exit(1);
});
