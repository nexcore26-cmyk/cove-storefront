import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'https://store.coveinterior.com/api/trpc',
      transformer: superjson,
      headers() {
        return { 'user-agent': 'Mozilla/5.0 CoveVerification/1.0' };
      },
    }),
  ],
});

const categoriesResponse = await client.categories.list.query({});
const categories = Array.isArray(categoriesResponse) ? categoriesResponse : (categoriesResponse.items ?? categoriesResponse.categories ?? categoriesResponse.data ?? []);
console.log(`categories_shape=${Array.isArray(categoriesResponse) ? 'array' : Object.keys(categoriesResponse).join(',')}`);
const legacy = categories.filter((cat) => {
  const haystack = `${cat.name ?? ''} ${cat.slug ?? ''}`.toLowerCase();
  return ['web', 'store', 'event'].some((token) => haystack.includes(token));
});

console.log(`legacy_category_candidates=${legacy.length}`);
for (const cat of legacy.slice(0, 8)) {
  const result = await client.products.list.query({ categoryId: cat.id, limit: 3 });
  console.log(JSON.stringify({
    category_id: cat.id,
    category_name: cat.name,
    category_slug: cat.slug,
    total: result.total,
    returned: result.items.length,
    sample_product_ids: result.items.map((item) => item.id),
    sample_product_category_ids: result.items.map((item) => item.categoryId),
    sample_product_names: result.items.map((item) => item.name),
  }));
}
