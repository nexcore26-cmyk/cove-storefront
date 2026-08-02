/**
 * Bulk auto-translate missing Arabic product translations.
 * Calls the translations.bulkAutoTranslate tRPC mutation directly via the DB
 * using the same logic as the procedure (no HTTP needed — runs in-process).
 */
import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load env from .env file
const { config } = await import('dotenv');
config({ path: new URL('../.env', import.meta.url).pathname });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_API_URL || !FORGE_API_KEY) {
  console.error('BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY not set');
  process.exit(1);
}

// Connect to DB
const { drizzle } = await import('drizzle-orm/mysql2');
const mysql = await import('mysql2/promise');
const connection = await mysql.default.createConnection(DATABASE_URL);
const db = drizzle(connection);

const { products, productTranslations } = await import('../drizzle/schema.ts');
const { notExists, and, eq } = await import('drizzle-orm');

// Find untranslated products
const untranslated = await db.select({
  id: products.id,
  name: products.name,
  description: products.description,
  shortDescription: products.shortDescription,
}).from(products)
  .where(notExists(
    db.select().from(productTranslations)
      .where(and(eq(productTranslations.productId, products.id), eq(productTranslations.locale, 'ar')))
  ));

console.log(`Found ${untranslated.length} products without Arabic translations`);

let translated = 0;
let failed = 0;

for (const product of untranslated) {
  try {
    const resp = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a professional Arabic translator for luxury home decor. Respond with valid JSON only.' },
          { role: 'user', content: `Translate to Arabic for Gulf market. Return JSON with fields: name, shortDescription, description.\nProduct: ${product.name}\nShort: ${product.shortDescription || ''}\nDesc: ${product.description || ''}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'arabic_translation',
            strict: true,
            schema: {
              type: 'object',
              properties: { name: { type: 'string' }, shortDescription: { type: 'string' }, description: { type: 'string' } },
              required: ['name', 'shortDescription', 'description'],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) { failed++; console.log(`  ✗ ${product.name} — no content`); continue; }
    const result = typeof content === 'string' ? JSON.parse(content) : content;
    await db.insert(productTranslations).values({
      productId: product.id,
      locale: 'ar',
      name: result.name,
      description: result.description,
      shortDescription: result.shortDescription,
    });
    translated++;
    console.log(`  ✓ ${product.name} → ${result.name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${product.name} — error: ${err.message}`);
  }
}

console.log(`\nDone: ${translated} translated, ${failed} failed out of ${untranslated.length}`);
await connection.end();
