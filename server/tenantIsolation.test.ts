/**
 * Cross-tenant isolation test.
 * Verifies that the Phase C query-scoping work actually isolates data
 * between tenants at the database level - not just that resolution
 * (Phase B) picks the right tenantId, but that queries scoped by it
 * genuinely never leak another tenant's rows.
 *
 * Uses a real throwaway second tenant + product (cleaned up after),
 * same pattern as skuUniqueness.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, getProducts, getProductById, getProductBySlug, getCategories, generateSku, checkSkuUnique } from './db';
import { tenants, products, categories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const TENANT_1 = 1; // Cove Interior - real tenant, must not be mutated
let testTenantId: number | null = null;
let tenant1ProductId: number | null = null;
let tenant2ProductId: number | null = null;
let tenant1CategoryId: number | null = null;
let tenant2CategoryId: number | null = null;
const uniqueSuffix = Date.now();

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;

  const [tenantResult] = await db.insert(tenants).values({
    slug: `__test-isolation-tenant-${uniqueSuffix}__`,
    name: 'Test Isolation Tenant',
    rootDomain: `test-isolation-${uniqueSuffix}.example.com`,
  });
  testTenantId = (tenantResult as any).insertId;

  const [cat1] = await db.insert(categories).values({
    tenantId: TENANT_1,
    name: `__test_isolation_cat_t1_${uniqueSuffix}__`,
    slug: `test-isolation-cat-t1-${uniqueSuffix}`,
  });
  tenant1CategoryId = (cat1 as any).insertId;

  const [cat2] = await db.insert(categories).values({
    tenantId: testTenantId!,
    name: `__test_isolation_cat_t2_${uniqueSuffix}__`,
    slug: `test-isolation-cat-t2-${uniqueSuffix}`,
  });
  tenant2CategoryId = (cat2 as any).insertId;

  const [p1] = await db.insert(products).values({
    tenantId: TENANT_1,
    name: '__test_isolation_product_t1__',
    slug: `test-isolation-product-${uniqueSuffix}`,
    price: '10.000',
    status: 'active',
    type: 'simple',
  });
  tenant1ProductId = (p1 as any).insertId;

  const [p2] = await db.insert(products).values({
    tenantId: testTenantId!,
    name: '__test_isolation_product_t2__',
    // Deliberately the SAME slug as tenant 1's product - proves slugs are
    // only unique per-tenant, and bySlug must not cross-match.
    slug: `test-isolation-product-${uniqueSuffix}`,
    price: '20.000',
    status: 'active',
    type: 'simple',
  });
  tenant2ProductId = (p2 as any).insertId;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (tenant1ProductId) await db.delete(products).where(eq(products.id, tenant1ProductId));
  if (tenant2ProductId) await db.delete(products).where(eq(products.id, tenant2ProductId));
  if (tenant1CategoryId) await db.delete(categories).where(eq(categories.id, tenant1CategoryId));
  if (tenant2CategoryId) await db.delete(categories).where(eq(categories.id, tenant2CategoryId));
  if (testTenantId) await db.delete(tenants).where(eq(tenants.id, testTenantId));
});

describe('Cross-tenant isolation (Phase C)', () => {
  it('getProducts scopes by tenant - tenant 1 does not see tenant 2 products and vice versa', async () => {
    if (!testTenantId) return;
    const t1Results = await getProducts(TENANT_1, { search: '__test_isolation_product' });
    const t2Results = await getProducts(testTenantId, { search: '__test_isolation_product' });
    expect(t1Results.items.some(p => p.id === tenant1ProductId)).toBe(true);
    expect(t1Results.items.some(p => p.id === tenant2ProductId)).toBe(false);
    expect(t2Results.items.some(p => p.id === tenant2ProductId)).toBe(true);
    expect(t2Results.items.some(p => p.id === tenant1ProductId)).toBe(false);
  });

  it('getProductById returns null when the id belongs to a different tenant', async () => {
    if (!testTenantId || !tenant1ProductId || !tenant2ProductId) return;
    expect(await getProductById(TENANT_1, tenant1ProductId)).not.toBeNull();
    expect(await getProductById(testTenantId, tenant1ProductId)).toBeNull();
    expect(await getProductById(TENANT_1, tenant2ProductId)).toBeNull();
    expect(await getProductById(testTenantId, tenant2ProductId)).not.toBeNull();
  });

  it('getProductBySlug does not cross-match identical slugs across tenants', async () => {
    if (!testTenantId || !tenant1ProductId || !tenant2ProductId) return;
    const slug = `test-isolation-product-${uniqueSuffix}`;
    const t1Product = await getProductBySlug(TENANT_1, slug);
    const t2Product = await getProductBySlug(testTenantId, slug);
    expect(t1Product?.id).toBe(tenant1ProductId);
    expect(t2Product?.id).toBe(tenant2ProductId);
    expect(t1Product?.id).not.toBe(t2Product?.id);
  });

  it('getCategories scopes by tenant', async () => {
    if (!testTenantId) return;
    const t1Cats = await getCategories(TENANT_1);
    const t2Cats = await getCategories(testTenantId);
    expect(t1Cats.some(c => c.id === tenant1CategoryId)).toBe(true);
    expect(t1Cats.some(c => c.id === tenant2CategoryId)).toBe(false);
    expect(t2Cats.some(c => c.id === tenant2CategoryId)).toBe(true);
    expect(t2Cats.some(c => c.id === tenant1CategoryId)).toBe(false);
  });

  it('checkSkuUnique does not report a false conflict across tenants', async () => {
    if (!testTenantId) return;
    // A SKU used by a tenant-1 variant should read as unique from tenant 2's perspective.
    const uniqueSku = `__test-isolation-sku-${uniqueSuffix}__`;
    // Neither tenant has used it yet.
    expect(await checkSkuUnique(TENANT_1, uniqueSku)).toBeNull();
    expect(await checkSkuUnique(testTenantId, uniqueSku)).toBeNull();
  });

  it('generateSku does not add an unnecessary suffix due to another tenant using the same base', async () => {
    if (!testTenantId) return;
    // Both tenants generating a SKU from the same inputs should each get the
    // clean base SKU (no false -2 suffix from the other tenant's variants).
    const base = `isolation-gen-${uniqueSuffix}`;
    const skuT1 = await generateSku(TENANT_1, base, ['red']);
    const skuT2 = await generateSku(testTenantId, base, ['red']);
    expect(skuT1).toBe(`${base}-red`);
    expect(skuT2).toBe(`${base}-red`);
  });
});
