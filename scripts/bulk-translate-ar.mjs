/**
 * Bulk Arabic Translation Script
 * Uses the built-in LLM API to translate product and category names/descriptions to Arabic.
 * Runs in batches to avoid rate limits.
 */
import mysql from 'mysql2/promise';
import 'dotenv/config';

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, '');
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_URL || !FORGE_KEY) {
  console.error('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

async function callLLM(messages) {
  const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FORGE_KEY}`,
    },
    body: JSON.stringify({ messages, max_tokens: 800 }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function translateBatch(items) {
  // Build a numbered list for the LLM to translate
  const list = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const prompt = `You are a professional Arabic translator specializing in luxury furniture and interior design.
Translate the following product/category names from English to Arabic.
Rules:
- Keep brand names and product model names as-is (e.g. "Roshina", "Curve", "DeCaf", "Mubkhar", "Classic", "Country", "Brass")
- Use formal Modern Standard Arabic (فصحى)
- Return ONLY a numbered list matching the input, one translation per line
- Do not add explanations or extra text

${list}`;

  const response = await callLLM([
    { role: 'system', content: 'You are a professional Arabic translator for luxury furniture.' },
    { role: 'user', content: prompt },
  ]);

  // Parse the numbered list response
  const lines = response.split('\n').filter(l => l.trim());
  const translations = [];
  for (let i = 0; i < items.length; i++) {
    const line = lines[i] || '';
    // Remove leading number and dot: "1. " or "١. "
    const cleaned = line.replace(/^[\d١٢٣٤٥٦٧٨٩٠]+[.\-\)]\s*/, '').trim();
    translations.push(cleaned || items[i]); // fallback to original if empty
  }
  return translations;
}

async function translateDescription(name, description) {
  if (!description || description.trim() === '') return '';
  // Strip HTML tags for translation
  const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plainText.length < 5) return '';

  const prompt = `Translate this product description for "${name}" from English to Arabic.
Use formal Modern Standard Arabic. Keep brand names as-is.
Return ONLY the Arabic translation, no explanations.

${plainText.substring(0, 500)}`;

  return callLLM([
    { role: 'system', content: 'You are a professional Arabic translator for luxury furniture.' },
    { role: 'user', content: prompt },
  ]);
}

const BATCH_SIZE = 10;
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Translate Categories ──────────────────────────────────────────────────────
console.log('\n=== Translating Categories ===');
const [categories] = await conn.query(`
  SELECT c.id, c.name
  FROM categories c
  LEFT JOIN category_translations ct ON ct.categoryId = c.id AND ct.locale = 'ar'
  WHERE ct.id IS NULL AND c.isActive = 1
`);
console.log(`Found ${categories.length} categories without Arabic translation`);

for (let i = 0; i < categories.length; i += BATCH_SIZE) {
  const batch = categories.slice(i, i + BATCH_SIZE);
  const names = batch.map(c => c.name);
  console.log(`  Translating categories ${i + 1}–${Math.min(i + BATCH_SIZE, categories.length)}...`);

  try {
    const translations = await translateBatch(names);
    for (let j = 0; j < batch.length; j++) {
      const cat = batch[j];
      const arName = translations[j];
      await conn.query(
        `INSERT INTO category_translations (categoryId, locale, name, createdAt, updatedAt)
         VALUES (?, 'ar', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), updatedAt = NOW()`,
        [cat.id, arName]
      );
    }
    console.log(`    ✓ Done batch`);
  } catch (err) {
    console.error(`    ✗ Error:`, err.message);
  }
  await sleep(DELAY_MS);
}

// ── Translate Products ────────────────────────────────────────────────────────
console.log('\n=== Translating Products ===');
const [products] = await conn.query(`
  SELECT p.id, p.name, p.description, p.shortDescription
  FROM products p
  LEFT JOIN product_translations pt ON pt.productId = p.id AND pt.locale = 'ar'
  WHERE pt.id IS NULL AND p.status = 'active'
`);
console.log(`Found ${products.length} products without Arabic translation`);

// First pass: translate names in batches
const productNames = products.map(p => p.name);
const allNameTranslations = [];

for (let i = 0; i < productNames.length; i += BATCH_SIZE) {
  const batch = productNames.slice(i, i + BATCH_SIZE);
  console.log(`  Translating product names ${i + 1}–${Math.min(i + BATCH_SIZE, productNames.length)}...`);
  try {
    const translations = await translateBatch(batch);
    allNameTranslations.push(...translations);
    console.log(`    ✓ Done batch`);
  } catch (err) {
    console.error(`    ✗ Error:`, err.message);
    // Push originals as fallback
    allNameTranslations.push(...batch);
  }
  await sleep(DELAY_MS);
}

// Second pass: translate descriptions individually (they are longer)
console.log('\n  Translating product descriptions...');
for (let i = 0; i < products.length; i++) {
  const product = products[i];
  const arName = allNameTranslations[i] || product.name;

  let arDescription = '';
  let arShortDescription = '';

  try {
    if (product.description && product.description.trim().length > 10) {
      arDescription = await translateDescription(product.name, product.description);
    }
    if (product.shortDescription && product.shortDescription.trim().length > 5) {
      arShortDescription = await translateDescription(product.name, product.shortDescription);
    }
  } catch (err) {
    console.error(`    ✗ Description error for ${product.name}:`, err.message);
  }

  await conn.query(
    `INSERT INTO product_translations (productId, locale, name, description, shortDescription, createdAt, updatedAt)
     VALUES (?, 'ar', ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), shortDescription = VALUES(shortDescription), updatedAt = NOW()`,
    [product.id, arName, arDescription, arShortDescription]
  );

  if ((i + 1) % 10 === 0 || i === products.length - 1) {
    console.log(`    ✓ ${i + 1}/${products.length} products processed`);
  }
  await sleep(200);
}

await conn.end();
console.log('\n✅ Bulk Arabic translation complete!');
