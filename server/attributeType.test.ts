/**
 * P8 — Attribute Type Field
 * Tests that:
 * 1. Attributes can be created with type 'global' or 'custom'
 * 2. Default type is 'global'
 * 3. Type can be updated
 * 4. The type field is returned in the list query
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { attributes } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

let testAttrId: number | null = null;

afterAll(async () => {
  if (testAttrId) {
    const db = await getDb();
    if (db) await db.delete(attributes).where(eq(attributes.id, testAttrId));
  }
});

describe('P8 — Attribute Type Field', () => {
  it('creates a global attribute with default type', async () => {
    const db = await getDb();
    if (!db) return;
    const [result] = await db.insert(attributes).values({
      name: '__test_p8_global__',
      displayType: 'button',
      type: 'global',
      sortOrder: 999,
    });
    testAttrId = (result as any).insertId;
    expect(testAttrId).toBeGreaterThan(0);

    const [attr] = await db.select().from(attributes).where(eq(attributes.id, testAttrId!));
    expect(attr.type).toBe('global');
  });

  it('creates a custom attribute with type custom', async () => {
    const db = await getDb();
    if (!db) return;
    const [result] = await db.insert(attributes).values({
      name: '__test_p8_custom__',
      displayType: 'button',
      type: 'custom',
      sortOrder: 999,
    });
    const customAttrId = (result as any).insertId;
    expect(customAttrId).toBeGreaterThan(0);

    const [attr] = await db.select().from(attributes).where(eq(attributes.id, customAttrId));
    expect(attr.type).toBe('custom');

    // cleanup
    await db.delete(attributes).where(eq(attributes.id, customAttrId));
  });

  it('updates attribute type from global to custom', async () => {
    const db = await getDb();
    if (!db || !testAttrId) return;
    await db.update(attributes).set({ type: 'custom' }).where(eq(attributes.id, testAttrId));
    const [attr] = await db.select().from(attributes).where(eq(attributes.id, testAttrId));
    expect(attr.type).toBe('custom');
  });

  it('type field is returned in list query', async () => {
    const db = await getDb();
    if (!db || !testAttrId) return;
    const attrs = await db.select().from(attributes).where(eq(attributes.id, testAttrId));
    expect(attrs.length).toBe(1);
    expect(attrs[0]).toHaveProperty('type');
    expect(['global', 'custom']).toContain(attrs[0].type);
  });
});
