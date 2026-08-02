import { getDb } from './server/db.ts';
import { productVariants } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();
const rows = await db
  .select({
    id: productVariants.id,
    wcVariantId: productVariants.wcVariantId,
    sku: productVariants.sku,
    name: productVariants.name,
    attributes: productVariants.attributes,
    image: productVariants.image,
    galleryImages: productVariants.galleryImages,
    isActive: productVariants.isActive,
  })
  .from(productVariants)
  .where(eq(productVariants.productId, 30154));

const simplified = rows.map((r) => ({
  id: r.id,
  wcVariantId: r.wcVariantId,
  sku: r.sku,
  name: r.name,
  attributes: r.attributes,
  isActive: r.isActive,
  hasImage: Boolean(r.image),
  image: r.image ? String(r.image).split('/').pop() : null,
  galleryCount: Array.isArray(r.galleryImages) ? r.galleryImages.length : 0,
  galleryImages: Array.isArray(r.galleryImages) ? r.galleryImages.map((x) => String(x).split('/').pop()) : [],
}));

console.log(JSON.stringify({ count: rows.length, rows: simplified }, null, 2));
