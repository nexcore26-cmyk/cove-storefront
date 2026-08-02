/**
 * AdminBundles — Phase 21
 *
 * Lists all products with type='bundle'. For each bundle product, shows its
 * variants. Per variant, the admin can add/remove component variants with qty.
 *
 * Workflow:
 *   1. Select a bundle product → expand its variants
 *   2. For each variant → click "Edit Components"
 *   3. Search for component variants by product/variant name
 *   4. Set qty per component
 *   5. Save → calls bundles.setItems
 */

import { useState, useCallback, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  Save,
  Loader2,
  Box,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComponentItem {
  componentVariantId: number;
  qty: number;
  // Display info (populated from search or existing items)
  productName?: string;
  variantName?: string;
  variantSku?: string | null;
  variantImage?: string | null;
}

// ─── Component: VariantEditor ─────────────────────────────────────────────────

function VariantEditor({
  bundleVariantId,
  variantName,
}: {
  bundleVariantId: number;
  variantName: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Load existing bundle items
  const { isLoading: isLoadingItems, data: existingItems } = trpc.bundles.getItems.useQuery(
    { bundleVariantId }
  );
  // Populate components from server data on first load (useEffect to avoid setState-in-render)
  useEffect(() => {
    if (!isLoaded && existingItems && !isLoadingItems) {
      setComponents(
        existingItems.map((row: any) => ({
          componentVariantId: row.componentVariantId,
          qty: parseFloat(String(row.qty)),
          productName: row.productName,
          variantName: row.variantName,
          variantSku: row.variantSku,
          variantImage: row.variantImage,
        }))
      );
      setIsLoaded(true);
    }
  }, [existingItems, isLoadingItems, isLoaded]);

  // Search variants typeahead
  const { data: searchResults, isFetching: isSearching } =
    trpc.bundles.searchVariants.useQuery(
      { query: searchQuery },
      { enabled: searchQuery.length >= 2 }
    );

  // Save mutation
  const utils = trpc.useUtils();
  const setItemsMutation = trpc.bundles.setItems.useMutation({
    onSuccess: () => {
      toast.success("Bundle components saved");
      utils.bundles.getItems.invalidate({ bundleVariantId });
    },
    onError: (err: any) => {
      toast.error("Save failed: " + err.message);
    },
  });

  const handleAddComponent = useCallback(
    (result: any) => {
      // Prevent duplicates
      if (components.some((c) => c.componentVariantId === result.variantId)) {
        toast.info("Already added — this variant is already in the bundle");
        return;
      }
      setComponents((prev) => [
        ...prev,
        {
          componentVariantId: result.variantId,
          qty: 1,
          productName: result.productName,
          variantName: result.variantName,
          variantSku: result.variantSku,
          variantImage: result.variantImage,
        },
      ]);
      setSearchQuery("");
    },
    [components, toast]
  );

  const handleRemove = (variantId: number) => {
    setComponents((prev) => prev.filter((c) => c.componentVariantId !== variantId));
  };

  const handleQtyChange = (variantId: number, value: string) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty <= 0) return;
    setComponents((prev) =>
      prev.map((c) => (c.componentVariantId === variantId ? { ...c, qty } : c))
    );
  };

  const handleSave = () => {
    setItemsMutation.mutate({
      bundleVariantId,
      items: components.map((c) => ({ componentVariantId: c.componentVariantId, qty: c.qty })),
    });
  };

  if (isLoadingItems) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading components...
      </div>
    );
  }

  return (
    <div className="space-y-4 py-3">
      {/* Component list */}
      {components.length > 0 ? (
        <div className="space-y-2">
          {components.map((comp) => (
            <div
              key={comp.componentVariantId}
              className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2"
            >
              {comp.variantImage ? (
                <img
                  src={comp.variantImage}
                  alt=""
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                  <Box className="w-4 h-4 text-zinc-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {comp.productName}
                </p>
                <p className="text-xs text-zinc-400 truncate">{comp.variantName}</p>
              </div>
              {comp.variantSku && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {comp.variantSku}
                </Badge>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-zinc-400">Qty:</label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={comp.qty}
                  onChange={(e) => handleQtyChange(comp.componentVariantId, e.target.value)}
                  className="w-20 h-7 text-xs bg-zinc-900 border-zinc-700"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                onClick={() => handleRemove(comp.componentVariantId)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          No components defined. Search below to add component variants.
        </p>
      )}

      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search products or variants to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-zinc-500" />
          )}
        </div>

        {/* Dropdown results */}
        {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
            {searchResults.map((result: any) => (
              <button
                key={result.variantId}
                onClick={() => handleAddComponent(result)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 text-left transition-colors"
              >
                {result.variantImage ? (
                  <img
                    src={result.variantImage}
                    alt=""
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Box className="w-4 h-4 text-zinc-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">
                    {result.productName}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">{result.variantName}</p>
                </div>
                {result.variantSku && (
                  <span className="text-xs text-zinc-500 shrink-0">{result.variantSku}</span>
                )}
                <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && searchResults?.length === 0 && !isSearching && (
          <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-3 text-sm text-zinc-500">
            No variants found for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={setItemsMutation.isPending}
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {setItemsMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Components
        </Button>
      </div>
    </div>
  );
}

// ─── Component: BundleProductCard ─────────────────────────────────────────────

function BundleProductCard({ product }: { product: any }) {
  const [expanded, setExpanded] = useState(false);
  const [activeVariantId, setActiveVariantId] = useState<number | null>(null);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Product header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/50 transition-colors text-left"
      >
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-zinc-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate">{product.name}</h3>
          <p className="text-sm text-zinc-500">
            {product.variants?.length || 0} variant{product.variants?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 shrink-0">
          Bundle
        </Badge>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
        )}
      </button>

      {/* Variants list */}
      {expanded && (
        <div className="border-t border-zinc-800 divide-y divide-zinc-800">
          {product.variants?.length === 0 ? (
            <div className="px-5 py-4 text-sm text-zinc-500 italic">
              No variants found for this product.
            </div>
          ) : (
            product.variants?.map((variant: any) => (
              <div key={variant.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  {variant.image ? (
                    <img
                      src={variant.image}
                      alt={variant.name}
                      className="w-9 h-9 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Box className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{variant.name}</p>
                    {variant.sku && (
                      <p className="text-xs text-zinc-500">SKU: {variant.sku}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setActiveVariantId(activeVariantId === variant.id ? null : variant.id)
                    }
                    className="shrink-0 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    {activeVariantId === variant.id ? "Close" : "Edit Components"}
                  </Button>
                </div>

                {/* Component editor for this variant */}
                {activeVariantId === variant.id && (
                  <div className="mt-3 pl-12">
                    <VariantEditor
                      bundleVariantId={variant.id}
                      variantName={variant.name}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBundles() {
  const { data: bundleProducts, isLoading } = trpc.bundles.listBundleProducts.useQuery();

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-500" />
              Bundle Products
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Configure which component variants make up each bundle variant. The bundle's
              effective stock is the minimum stock across all its components.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-5 py-4 text-sm text-amber-200/80 space-y-1">
          <p className="font-semibold text-amber-300">How bundle stock works:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/70">
            <li>A bundle variant's available stock = min(component stock ÷ qty) across all components</li>
            <li>When a bundle is purchased, stock is deducted from each component variant</li>
            <li>If any component is out of stock, the bundle variant shows as out of stock</li>
          </ul>
        </div>

        {/* Bundle products list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading bundle products...
          </div>
        ) : !bundleProducts || bundleProducts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-xl">
            <Package className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-zinc-300 font-medium mb-1">No bundle products found</h3>
            <p className="text-sm text-zinc-500">
              Go to{" "}
              <a href="/admin/products" className="text-amber-400 hover:underline">
                Admin → Products
              </a>{" "}
              and set a product's type to "Bundle" to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bundleProducts.map((product: any) => (
              <BundleProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
