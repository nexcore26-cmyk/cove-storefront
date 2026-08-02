/**
 * merge-categories.mjs
 *
 * Merges the fragmented "web" / "store" / "event" category rows into a single
 * unified category per product family.
 *
 * Strategy:
 *  1. Strip the suffix (web, store, event, vendor, boxes, display) from each
 *     category name to get a "base name".
 *  2. Group all categories that share the same base name.
 *  3. For each group, pick the canonical row (prefer wcSource=main, then
 *     lowest id) and update it:
 *       - name  = base name (trimmed)
 *       - slug  = url-safe base name
 *       - channel = "both"
 *  4. Re-point all products that reference a non-canonical category to the
 *     canonical one.
 *  5. Deactivate (isActive=0) all non-canonical rows.
 *
 * Run: node scripts/merge-categories.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const SUFFIX_RE = /\s+(web|store|event|vendor|boxes?|display|vendors?)\s*$/i;

function baseName(name) {
  return name.replace(SUFFIX_RE, '').trim();
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Fetch all active categories
  const [allCats] = await conn.execute(
    'SELECT id, name, slug, channel, wcSource, isActive FROM categories WHERE isActive = 1 ORDER BY wcSource ASC, id ASC'
  );

  // 2. Group by base name (case-insensitive)
  const groups = new Map(); // baseNameLower -> [cat, ...]
  for (const cat of allCats) {
    const base = baseName(cat.name);
    const key = base.toLowerCase();
    if (!groups.has(key)) groups.set(key, { base, cats: [] });
    groups.get(key).cats.push(cat);
  }

  console.log(`Found ${groups.size} unique base categories from ${allCats.length} rows`);

  let mergedCount = 0;
  let skippedCount = 0;

  for (const [key, { base, cats }] of groups) {
    if (cats.length === 1) {
      // Only one row — just clean the name and set channel
      const cat = cats[0];
      const cleanName = base;
      const cleanSlug = toSlug(base);
      // Determine channel from existing name suffix
      const hasWeb = /\bweb\b/i.test(cat.name);
      const hasStore = /\bstore\b/i.test(cat.name) || /\bvendor\b/i.test(cat.name);
      let channel = cat.channel;
      if (hasWeb && !hasStore) channel = 'online';
      else if (hasStore && !hasWeb) channel = 'pos';
      // If already clean, skip
      if (cat.name === cleanName && cat.channel === channel) {
        skippedCount++;
        continue;
      }
      await conn.execute(
        'UPDATE categories SET name = ?, slug = ?, channel = ? WHERE id = ?',
        [cleanName, cleanSlug, channel, cat.id]
      );
      console.log(`  Renamed single: "${cat.name}" → "${cleanName}" (channel: ${channel})`);
      mergedCount++;
      continue;
    }

    // Multiple rows — pick canonical
    // Prefer: wcSource=main first, then lowest id
    const mainCats = cats.filter(c => c.wcSource === 'main');
    const canonical = mainCats.length > 0
      ? mainCats.sort((a, b) => a.id - b.id)[0]
      : cats.sort((a, b) => a.id - b.id)[0];

    const cleanName = base;
    const cleanSlug = toSlug(base);

    // Determine unified channel
    const hasWeb = cats.some(c => c.channel === 'online' || /\bweb\b/i.test(c.name));
    const hasStore = cats.some(c => c.channel === 'pos' || /\bstore\b/i.test(c.name) || /\bvendor\b/i.test(c.name));
    let unifiedChannel = 'none';
    if (hasWeb && hasStore) unifiedChannel = 'both';
    else if (hasWeb) unifiedChannel = 'online';
    else if (hasStore) unifiedChannel = 'pos';

    // Update canonical row
    await conn.execute(
      'UPDATE categories SET name = ?, slug = ?, channel = ?, wcSource = "main" WHERE id = ?',
      [cleanName, cleanSlug, unifiedChannel, canonical.id]
    );

    // Re-point products from non-canonical rows to canonical
    const nonCanonical = cats.filter(c => c.id !== canonical.id);
    for (const nc of nonCanonical) {
      const [updated] = await conn.execute(
        'UPDATE products SET categoryId = ? WHERE categoryId = ?',
        [canonical.id, nc.id]
      );
      if (updated.affectedRows > 0) {
        console.log(`  Re-pointed ${updated.affectedRows} products from cat ${nc.id} ("${nc.name}") → ${canonical.id} ("${cleanName}")`);
      }
      // Deactivate non-canonical
      await conn.execute('UPDATE categories SET isActive = 0 WHERE id = ?', [nc.id]);
    }

    console.log(`  Merged ${cats.length} rows → "${cleanName}" (id:${canonical.id}, channel:${unifiedChannel})`);
    mergedCount++;
  }

  console.log(`\nDone. Merged/renamed: ${mergedCount}, Skipped (already clean): ${skippedCount}`);

  // Show final state
  const [final] = await conn.execute(
    'SELECT id, name, slug, channel, wcSource FROM categories WHERE isActive = 1 ORDER BY name'
  );
  console.log(`\nActive categories after merge (${final.length}):`);
  final.forEach(c => console.log(`  [${c.id}] ${c.name} (${c.channel}) [${c.wcSource}]`));

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
