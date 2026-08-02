/**
 * fix-category-slugs.mjs
 *
 * Cleans up category names and slugs:
 * - Remove "main-" and "brass-" prefixes from slugs
 * - Remove " web", " store", " Store", " Web" suffixes from names
 * - Remove "-web", "-store" suffixes from slugs
 * - Deduplicate: if two categories (pos + online) end up with the same clean slug,
 *   keep the online one as canonical, reassign products from pos to online, delete pos
 * - Update category_translations to match cleaned names
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';

config();

const conn = await createConnection(process.env.DATABASE_URL);

function cleanName(name) {
  return name
    .replace(/\s+(web|store|Store|Web|event|Event)$/i, '')
    .trim();
}

function cleanSlug(slug) {
  return slug
    .replace(/^(main-|brass-)/, '')
    .replace(/-(web|store|event)$/, '')
    .trim();
}

// 1. Fetch all categories
const [allCats] = await conn.query('SELECT id, name, slug, channel FROM categories ORDER BY id');
console.log(`Total categories: ${allCats.length}`);

// 2. Build clean name/slug for each
const updates = allCats.map(c => ({
  ...c,
  cleanName: cleanName(c.name),
  cleanSlug: cleanSlug(c.slug),
}));

// 3. Group by cleanSlug to find duplicates
const byCleanSlug = {};
for (const cat of updates) {
  if (!byCleanSlug[cat.cleanSlug]) byCleanSlug[cat.cleanSlug] = [];
  byCleanSlug[cat.cleanSlug].push(cat);
}

const toDelete = []; // ids to delete (pos/brass duplicates)
const toKeep = [];   // canonical ids with their clean name/slug

for (const [cleanSlug, group] of Object.entries(byCleanSlug)) {
  if (group.length === 1) {
    toKeep.push({ id: group[0].id, cleanName: group[0].cleanName, cleanSlug });
    continue;
  }
  // Multiple rows with same cleanSlug — prefer online, then main-prefixed, then first
  const online = group.find(c => c.channel === 'online');
  const mainPrefixed = group.find(c => c.slug.startsWith('main-'));
  const canonical = online || mainPrefixed || group[0];
  toKeep.push({ id: canonical.id, cleanName: canonical.cleanName, cleanSlug });
  for (const dup of group) {
    if (dup.id !== canonical.id) {
      toDelete.push({ dupId: dup.id, canonicalId: canonical.id });
    }
  }
}

console.log(`\nCategories to keep/update: ${toKeep.length}`);
console.log(`Duplicate categories to merge+delete: ${toDelete.length}`);

// 4. Reassign products from duplicate categories to canonical
for (const { dupId, canonicalId } of toDelete) {
  const [affected] = await conn.query(
    'UPDATE products SET categoryId = ? WHERE categoryId = ?',
    [canonicalId, dupId]
  );
  if (affected.affectedRows > 0) {
    console.log(`  Reassigned ${affected.affectedRows} products from category ${dupId} → ${canonicalId}`);
  }
}

// 5. Delete duplicate categories (and their translations)
if (toDelete.length > 0) {
  const dupIds = toDelete.map(d => d.dupId);
  await conn.query(`DELETE FROM category_translations WHERE categoryId IN (${dupIds.join(',')})`)
  const [delResult] = await conn.query(`DELETE FROM categories WHERE id IN (${dupIds.join(',')})`);
  console.log(`\nDeleted ${delResult.affectedRows} duplicate category rows`);
}

// 6. Update canonical categories with clean names and slugs
let updatedCount = 0;
for (const { id, cleanName, cleanSlug } of toKeep) {
  const original = allCats.find(c => c.id === id);
  if (original.name !== cleanName || original.slug !== cleanSlug) {
    await conn.query('UPDATE categories SET name = ?, slug = ? WHERE id = ?', [cleanName, cleanSlug, id]);
    console.log(`  Updated cat ${id}: "${original.name}" (${original.slug}) → "${cleanName}" (${cleanSlug})`);
    updatedCount++;
  }
}
console.log(`\nUpdated ${updatedCount} category names/slugs`);

// 7. Update category_translations: clean the AR name too (strip suffixes if present)
const [translations] = await conn.query('SELECT id, categoryId, locale, name FROM category_translations');
let transUpdated = 0;
for (const t of translations) {
  const cleaned = cleanName(t.name);
  if (cleaned !== t.name) {
    await conn.query('UPDATE category_translations SET name = ? WHERE id = ?', [cleaned, t.id]);
    transUpdated++;
  }
}
console.log(`Updated ${transUpdated} category translation names`);

await conn.end();
console.log('\nDone!');
