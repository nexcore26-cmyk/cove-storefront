/**
 * P11 — SKU Uniqueness
 * Tests that:
 * 1. generateSku produces correct format: {productSlug}-{value1}-{value2}
 * 2. generateSku appends -2, -3 on collision
 * 3. checkSkuUnique returns null for unused SKU
 * 4. checkSkuUnique returns conflicting variant ID for duplicate SKU
 * 5. checkSkuUnique excludes the current variant ID (for updates)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { products, productVariants } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { generateSku, checkSkuUnique } from './db';

let testProductId: number | null = null;
let testVariantId1: number | null = null;
let testVariantId2: number | null = null;
const testSlug = `__test-p11-product-${Date.now()}__`;
// The generateSku slugifier strips underscores and collapses dashes
// so __test-p11-product-{ts}__-red becomes test-p11-product-{ts}-red
const testSku1 = testSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-red';

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;

  const [prodResult] = await db.insert(products).values({
    name: '__test_p11_product__',
    slug: testSlug,
    price: '10.000',
    status: 'draft',
    type: 'variable',
  });
  testProductId = (prodResult as any).insertId;

  // Create variant with a known SKU
  const [v1Result] = await db.insert(productVariants).values({
    productId: testProductId,
    name: 'Red',
    sku: testSku1,
    price: '10.000',
    attributes: {},
    isActive: true,
  });
  testVariantId1 = (v1Result as any).insertId;
});

afterAll(async () => {
  const db = await getDb();
  if (!db || !testProductId) return;
  await db.delete(productVariants).where(eq(productVariants.productId, testProductId));
  await db.delete(products).where(eq(products.id, testProductId));
});

describe('P11 — SKU Uniqueness', () => {
  it('generateSku produces correct format: {productSlug}-{value1}-{value2}', async () => {
    const sku = await generateSku('my-product', ['Red', 'Large']);
    // Should be: my-product-red-large (or with suffix if collision)
    expect(sku).toMatch(/^my-product-red-large/);
  });

  it('generateSku handles special characters in attribute values', async () => {
    const sku = await generateSku('test-product', ['Blue & White', '100% Cotton']);
    expect(sku).toMatch(/^test-product-blue-white-100-cotton/);
  });

  it('generateSku appends -2 on collision with existing SKU', async () => {
    // testSku1 = {testSlug}-red is already used by testVariantId1
    const sku = await generateSku(testSlug, ['red']);
    // Should get -2 suffix because base SKU is taken
    expect(sku).toBe(`${testSku1}-2`);
  });

  it('generateSku excludes current variant ID from collision check (for updates)', async () => {
    if (!testVariantId1) return;
    // When updating testVariantId1, the same SKU should be allowed
    const sku = await generateSku(testSlug, ['red'], testVariantId1);
    // Should return the base SKU (not -2) because we excluded testVariantId1
    expect(sku).toBe(testSku1);
  });

  it('checkSkuUnique returns null for unused SKU', async () => {
    const result = await checkSkuUnique('__definitely-unused-sku-p11__');
    expect(result).toBeNull();
  });

  it('checkSkuUnique returns conflicting variant ID for duplicate SKU', async () => {
    if (!testVariantId1) return;
    const result = await checkSkuUnique(testSku1);
    expect(result).toBe(testVariantId1);
  });

  it('checkSkuUnique excludes current variant ID (for updates)', async () => {
    if (!testVariantId1) return;
    // When updating testVariantId1, the same SKU should be allowed
    const result = await checkSkuUnique(testSku1, testVariantId1);
    expect(result).toBeNull();
  });

  it('generateSku produces unique SKUs across multiple variants', async () => {
    const db = await getDb();
    if (!db || !testProductId) return;

    // Create 5 variants with the same base slug to test collision handling
    const skus: string[] = [];
    const variantIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const sku = await generateSku('collision-test', ['blue']);
      // Insert to make it "taken"
      const [result] = await db.insert(productVariants).values({
        productId: testProductId,
        name: `Blue ${i}`,
        sku,
        price: '10.000',
        attributes: {},
        isActive: true,
      });
      variantIds.push((result as any).insertId);
      skus.push(sku);
    }

    // All SKUs should be unique
    const uniqueSkus = new Set(skus);
    expect(uniqueSkus.size).toBe(5);

    // Clean up
    for (const vid of variantIds) {
      await db.delete(productVariants).where(eq(productVariants.id, vid));
    }
  });
});
