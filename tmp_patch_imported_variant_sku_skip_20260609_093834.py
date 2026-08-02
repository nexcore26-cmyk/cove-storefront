from pathlib import Path
import time
stamp = '20260609_093834'
p = Path('server/routers.ts')
text = p.read_text()
backup = Path(f'server/routers.ts.bak_imported_variant_sku_skip_{stamp}')
old = '''      // P11: Check SKU uniqueness (skip check for WC-synced variants where duplicates are expected)
      const conflictId = await checkSkuUnique(sku, id);
      if (conflictId) {
        throw new TRPCError({ code: 'CONFLICT', message: `SKU "${sku}" is already used by variant ID ${conflictId}. Please use a different SKU.` });
      }
      const payload = { ...data, sku };
'''
new = '''      // P11: Check SKU uniqueness. Imported WooCommerce variants may legitimately share
      // the same parent SKU, so do not block saves for existing WC-synced rows.
      let skipSkuUniquenessForImportedVariant = false;
      if (id) {
        const [existingVariant] = await db.select({ wcVariantId: productVariants.wcVariantId })
          .from(productVariants)
          .where(eq(productVariants.id, id))
          .limit(1);
        skipSkuUniquenessForImportedVariant = Boolean(existingVariant?.wcVariantId);
      }
      if (!skipSkuUniquenessForImportedVariant) {
        const conflictId = await checkSkuUnique(sku, id);
        if (conflictId) {
          throw new TRPCError({ code: 'CONFLICT', message: `SKU "${sku}" is already used by variant ID ${conflictId}. Please use a different SKU.` });
        }
      }
      const payload = { ...data, sku };
'''
if 'skipSkuUniquenessForImportedVariant' in text:
    print('Patch already present; no edit needed.')
else:
    if old not in text:
        raise SystemExit('target block not found')
    backup.write_text(text)
    p.write_text(text.replace(old, new))
    print(f'Backed up {p} to {backup} and applied patch.')
