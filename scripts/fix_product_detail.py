content = open('/home/ubuntu/cove-storefront/client/src/pages/ProductDetail.tsx').read()

# Fix 1: Replace the useQuery line to destructure properly
old1 = "  const { data: product, isLoading, error } = trpc.products.bySlug.useQuery({ slug: slug || '' }, { enabled: !!slug });"
new1 = """  const { data: productData, isLoading, error } = trpc.products.bySlug.useQuery({ slug: slug || '' }, { enabled: !!slug });
  const product = productData?.product;
  const liveVariants: any[] = productData?.variants || [];"""
content = content.replace(old1, new1)

# Fix 2: Replace the images parsing block that references product.images directly
old2 = """  const images: string[] = Array.isArray(product.images)
    ? product.images
    : (typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })() : []);"""
new2 = """  const rawImages = (product as any)?.images;
  const images: string[] = Array.isArray(rawImages)
    ? rawImages
    : (typeof rawImages === 'string' ? (() => { try { return JSON.parse(rawImages || '[]'); } catch { return []; } })() : []);"""
content = content.replace(old2, new2)

# Fix 3: Replace liveVariants reference (it's already defined above now)
old3 = "  const variants: any[] = liveVariants;"
new3 = "  const variants: any[] = liveVariants;"
# Already correct, just make sure it's there

# Fix 4: Fix product.price, product.salePrice etc. - cast to any
old4 = "  const price = parseFloat(String(product.price || 0));\n  const salePrice = product.salePrice ? parseFloat(String(product.salePrice)) : null;"
new4 = "  const price = parseFloat(String((product as any)?.price || 0));\n  const salePrice = (product as any)?.salePrice ? parseFloat(String((product as any).salePrice)) : null;"
content = content.replace(old4, new4)

open('/home/ubuntu/cove-storefront/client/src/pages/ProductDetail.tsx', 'w').write(content)
print('ProductDetail.tsx fixed. Lines:', len(content.splitlines()))
