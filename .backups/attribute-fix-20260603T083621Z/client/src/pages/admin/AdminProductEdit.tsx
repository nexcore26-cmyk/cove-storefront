/**
 * Admin Product Edit / Create
 * Layout: single-column, no sidebar
 * Blocks (top → bottom):
 *   1. English Information (Name EN, Short Desc EN, Full Desc EN)
 *   2. Arabic Information  (Name AR, Short Desc AR, Full Desc AR)
 *   3. Pricing             (Price, Sale Price, COG)
 *   4. Product Details     (SKU, Weight, Tags, Measurement Type, Shipping Class)
 *   5. Status & Visibility (Status, Featured, New Arrival)
 *   6. Product Type        (Type selector)
 *   7. Category            (Category selector)
 *
 * Tabs (for advanced sections): Bundle, Custom Box, Vendors
 * Native media assignment is supported for product and variant images.
 */
import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NativeMediaField from '@/components/admin/NativeMediaField';
import {
  ArrowLeft, Save, Plus, Trash2,
  Loader2, Star, Sparkles, Building2, Sliders
} from 'lucide-react';

const MEASUREMENT_TYPES = [
  { value: 'unit', label: 'Unit (piece)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'roll', label: 'Roll' },
  { value: 'box', label: 'Box' },
];

const PRODUCT_TYPES = [
  { value: 'simple', label: 'Simple Product' },
  { value: 'variable', label: 'Variable Product' },
  { value: 'bundle', label: 'Bundle Product' },
  { value: 'custom_box', label: 'Custom Box' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (Published)' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export default function AdminProductEdit() {
  const [, params] = useRoute('/admin/products/:id');
  const [, navigate] = useLocation();
  const productId = params?.id === 'new' ? null : Number(params?.id);
  const isNew = !productId;

  const utils = trpc.useUtils();

  // ── Load existing product ──────────────────────────────────────────────────
  const [product, setProduct] = useState<any>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const { data: productById, isLoading } = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    shortDescription: '',
    shortDescriptionAr: '',
    sku: '',
    price: '0.000',
    salePrice: '',
    cog: '',
    measurementType: 'unit',
    type: 'simple',
    status: 'draft',
    isFeatured: false,
    isNew: false,
    categoryId: '',
    images: [] as string[],
    weight: '',
    tags: '',
    shippingClassId: null as number | null,
    kuwaitOnly: false,
  });

  const setField = (key: keyof typeof form, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (productById) {
      setProduct(productById.product);
      setForm({
        name: productById.product.name || '',
        nameAr: productById.product.nameAr || '',
        description: productById.product.description || '',
        descriptionAr: (productById.product as any).descriptionAr || '',
        shortDescription: productById.product.shortDescription || '',
        shortDescriptionAr: (productById.product as any).shortDescriptionAr || '',
        sku: productById.product.sku || '',
        price: productById.product.price || '0.000',
        salePrice: productById.product.salePrice || '',
        cog: productById.product.cog || '',
        measurementType: productById.product.measurementType || 'unit',
        type: productById.product.type || 'simple',
        status: productById.product.status || 'draft',
        isFeatured: productById.product.isFeatured || false,
        isNew: productById.product.isNew || false,
        categoryId: productById.product.categoryId ? String(productById.product.categoryId) : '',
        images: productById.product.images || [],
        weight: productById.product.weight || '',
        tags: ((productById.product as any).tags || []).join(', '),
        shippingClassId: (productById.product as any).shippingClassId ?? null,
        kuwaitOnly: (productById.product as any).kuwaitOnly ?? false,
      });
    }
  }, [productById]);

  // ── Categories ─────────────────────────────────────────────────────────────
  const { data: categories } = trpc.categories.list.useQuery({});

  // ── Shipping Classes ────────────────────────────────────────────────────────
  const { data: shippingClasses } = trpc.shipping.listShippingClasses.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = trpc.products.create.useMutation({
    onSuccess: (data) => {
      toast.success('Product created');
      navigate(`/admin/products/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success('Product saved');
      utils.products.list.invalidate();
      if (productId) utils.products.byId.invalidate({ id: productId });
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success('Product archived');
      utils.products.list.invalidate();
      if (productId) utils.products.byId.invalidate({ id: productId });
      setArchivingId(null);
      navigate('/admin/products');
    },
    onError: (e) => {
      setArchivingId(null);
      toast.error(e.message);
    },
  });

  // ── Save product ───────────────────────────────────────────────────────────
  const handleArchiveProduct = () => {
    if (!productId) return;
    const productLabel = `${form.name || 'this product'}${form.sku ? ` (SKU ${form.sku})` : ''}`;
    const confirmed = window.confirm(
      `Archive ${productLabel}?\n\nThis is the safe delete action: it hides the product from the active catalogue by changing its status to Archived. It does not remove historical orders, inventory records, or audit data.`
    );
    if (!confirmed) return;
    setArchivingId(productId);
    archiveMutation.mutate({ id: productId, status: 'archived', isFeatured: false, isNew: false });
  };

  const handleSave = () => {
    const payload = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || undefined,
      description: form.description.trim() || undefined,
      descriptionAr: form.descriptionAr.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      shortDescriptionAr: form.shortDescriptionAr.trim() || undefined,
      sku: form.sku.trim() || undefined,
      price: form.price || '0.000',
      salePrice: form.salePrice.trim() || undefined,
      cog: form.cog.trim() || undefined,
      measurementType: form.measurementType as any,
      type: form.type as any,
      status: form.status as any,
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      images: form.images,
      weight: form.weight.trim() || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      shippingClassId: form.shippingClassId ?? undefined,
      kuwaitOnly: form.kuwaitOnly,
    };
    if (isNew) {
      if (!payload.name) { toast.error('Product name is required'); return; }
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: productId!, ...payload });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || archiveMutation.isPending;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? 'New Product' : (form.name || 'Edit Product')}
              </h1>
              {!isNew && product && (
                <p className="text-sm text-muted-foreground">ID: {product.id} · Slug: {product.slug}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>
                {form.status}
              </Badge>
            )}
            {!isNew && form.status !== 'archived' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleArchiveProduct}
                disabled={isSaving || archivingId === productId}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                title="Safe delete: archive product"
              >
                {archiveMutation.isPending && archivingId === productId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {isNew ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* ── 1. English Information ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information — English</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Name (English) *</Label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Product name in English"
              />
            </div>
            <div className="space-y-1">
              <Label>Short Description (English)</Label>
              <Textarea
                value={form.shortDescription}
                onChange={(e) => setField('shortDescription', e.target.value)}
                placeholder="Brief product summary shown in listings"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Full Description (English)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Detailed product description"
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Arabic Information ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>معلومات المنتج — Arabic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" dir="rtl">
            <div className="space-y-1">
              <Label>الاسم (عربي)</Label>
              <Input
                value={form.nameAr}
                onChange={(e) => setField('nameAr', e.target.value)}
                placeholder="اسم المنتج بالعربية"
              />
            </div>
            <div className="space-y-1">
              <Label>وصف مختصر (عربي)</Label>
              <Textarea
                value={form.shortDescriptionAr}
                onChange={(e) => setField('shortDescriptionAr', e.target.value)}
                placeholder="ملخص قصير يظهر في القوائم"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>الوصف الكامل (عربي)</Label>
              <Textarea
                value={form.descriptionAr}
                onChange={(e) => setField('descriptionAr', e.target.value)}
                placeholder="وصف تفصيلي للمنتج"
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Pricing ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Price (KWD) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label>Sale Price (KWD)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.salePrice}
                  onChange={(e) => setField('salePrice', e.target.value)}
                  placeholder="Leave empty if no sale"
                />
              </div>
              <div className="space-y-1">
                <Label>Cost of Goods (KWD)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.cog}
                  onChange={(e) => setField('cog', e.target.value)}
                  placeholder="0.000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 4. Product Details ───────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setField('sku', e.target.value)}
                  placeholder="e.g. COV-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.weight}
                  onChange={(e) => setField('weight', e.target.value)}
                  placeholder="0.000"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setField('tags', e.target.value)}
                placeholder="e.g. luxury, handmade, new-arrival"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Measurement Type</Label>
                <Select value={form.measurementType} onValueChange={(v) => setField('measurementType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_TYPES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  For meter/kg/roll: price is per unit. Customer enters quantity at checkout.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Shipping Class</Label>
                <Select
                  value={form.shippingClassId ? String(form.shippingClassId) : 'none'}
                  onValueChange={(v) => setField('shippingClassId', v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping class..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No shipping class (default rate)</SelectItem>
                    {shippingClasses?.map((sc: any) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>
                        {sc.name} — KW: {sc.kuwaitCost} KWD | GCC: {sc.gccCostPerUnit} × qty
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Links to shipping cost rules. Leave empty for default rate.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.kuwaitOnly}
                  onCheckedChange={(v) => setField('kuwaitOnly', v)}
                />
                <div>
                  <Label>Kuwait Only</Label>
                  <p className="text-xs text-muted-foreground">Product cannot be shipped to GCC countries</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 5. Status & Visibility ───────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Status &amp; Visibility</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <div>
                  <Label>Featured</Label>
                  <p className="text-xs text-muted-foreground">Show on homepage featured section</p>
                </div>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => setField('isFeatured', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <div>
                  <Label>New Arrival</Label>
                  <p className="text-xs text-muted-foreground">Show "New" badge on product</p>
                </div>
              </div>
              <Switch
                checked={form.isNew}
                onCheckedChange={(v) => setField('isNew', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 6. Product Type ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Product Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setField('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── 7. Category ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Category</CardTitle></CardHeader>
          <CardContent>
            <Select
              value={form.categoryId || 'none'}
              onValueChange={(v) => setField('categoryId', v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {((categories as any)?.items ?? (categories as any) ?? []).map((cat: any) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* ── 8. Product Media ───────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Product Media</CardTitle></CardHeader>
          <CardContent>
            <NativeMediaField
              label="Product Images"
              value={form.images}
              multiple
              entityType="product"
              entityId={productId}
              helperText="Upload or select native Cove media. The first image is used as the primary product image."
              onChange={(images) => setField('images', images)}
            />
          </CardContent>
        </Card>

        {/* ── 9. Stock / Inventory ─────────────────────────────────────── */}
        <StockBlock productId={productId} />

        {/* ── Advanced tabs (Attributes / Bundle / Custom Box / Vendors) ──────
             Only shown for existing products, not for new ones              */}
        {!isNew && (
          <Tabs defaultValue="attributes">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="attributes">Attributes</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="bundle" disabled={form.type !== 'bundle'}>Bundle</TabsTrigger>
              <TabsTrigger value="custom_box" disabled={form.type !== 'custom_box'}>Custom Box</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
              <TabsTrigger value="preorder">Pre-Order</TabsTrigger>
            </TabsList>

            {/* Attributes */}
            <TabsContent value="attributes" className="mt-4">
              <AttributesTab productId={productId} />
            </TabsContent>

            {/* Variant Media */}
            <TabsContent value="media" className="mt-4">
              <VariantMediaTab productId={productId} />
            </TabsContent>

            {/* Bundle */}
            <TabsContent value="bundle" className="mt-4">
              <BundleTab productId={productId} />
            </TabsContent>

            {/* Custom Box */}
            <TabsContent value="custom_box" className="mt-4">
              <CustomBoxTab productId={productId} />
            </TabsContent>

            {/* Vendors */}
            <TabsContent value="vendors" className="mt-4">
              <VendorsTab productId={productId} />
            </TabsContent>

            {/* Pre-Order */}
            <TabsContent value="preorder" className="mt-4">
              <PreOrderTab productId={productId} />
            </TabsContent>
          </Tabs>
        )}

      </div>
    </AdminLayout>
  );
}

// ─── StockBlock ─────────────────────────────────────────────────────────────
function StockBlock({ productId }: { productId: number | null }) {
  const [, navigate] = useLocation();

  // For new products show a placeholder card
  const { data: warehouses = [] } = trpc.inventory.warehouses.useQuery();

  const { data: stockRows = [], isLoading } = trpc.inventory.stockByProducts.useQuery(
    { productIds: [productId!] },
    { enabled: !!productId }
  );

  // Build a map: warehouseId → quantity
  const stockMap = new Map<number, number>();
  (stockRows as any[]).forEach((row: any) => {
    stockMap.set(row.warehouseId, Number(row.quantity) || 0);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stock &amp; Inventory</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/inventory')}
          >
            Manage in Inventory
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Read-only. Adjust quantities from the Inventory page.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading stock...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(warehouses as any[]).map((wh: any) => {
              const qty = productId ? (stockMap.get(wh.id) ?? 0) : 0;
              return (
                <div
                  key={wh.id}
                  className="flex flex-col gap-1 p-3 rounded-lg border bg-muted/30"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {wh.name}
                  </span>
                  <span className={`text-2xl font-bold ${
                    qty === 0 ? 'text-destructive' : qty <= 5 ? 'text-yellow-500' : 'text-foreground'
                  }`}>
                    {qty}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : 'In stock'}
                  </span>
                </div>
              );
            })}
            {(warehouses as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground col-span-3">
                No warehouses configured yet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ─── VariantMediaTab ──────────────────────────────────────────────────────────
function VariantMediaTab({ productId }: { productId: number | null }) {
  const utils = trpc.useUtils();
  const { data: productById, isLoading } = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const variants = productById?.variants ?? [];

  const upsertVariantMutation = trpc.products.upsertVariant.useMutation({
    onSuccess: () => {
      toast.success('Variant media saved');
      if (productId) utils.products.byId.invalidate({ id: productId });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveVariantMedia = (variant: any, patch: { image?: string; galleryImages?: string[] }) => {
    upsertVariantMutation.mutate({
      id: variant.id,
      productId: productId!,
      name: variant.name,
      price: variant.price ?? '0.000',
      sku: variant.sku ?? undefined,
      salePrice: variant.salePrice ?? undefined,
      cog: variant.cog ?? undefined,
      attributes: variant.attributes ?? {},
      image: patch.image ?? variant.image ?? undefined,
      galleryImages: patch.galleryImages ?? variant.galleryImages ?? [],
      weight: variant.weight ?? undefined,
      isActive: variant.isActive ?? true,
      preOrderEnabled: variant.preOrderEnabled ?? false,
      preOrderLimit: variant.preOrderLimit ?? 0,
    });
  };

  if (!productId) return <p className="text-sm text-muted-foreground">Save the product first to configure variant media.</p>;
  if (isLoading) return <div className="flex items-center gap-2 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm text-muted-foreground">Loading variants...</span></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variant / Attribute Option Images</CardTitle>
        <p className="text-sm text-muted-foreground">Assign native Cove images to each generated variant. These images are shown when shoppers select the matching attribute option combination.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants found. Configure product attributes first to generate variants.</p>
        ) : variants.map((variant: any) => (
          <div key={variant.id} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{variant.name}</p>
                {variant.sku && <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>}
              </div>
              {variant.image && <img src={variant.image} alt={variant.name} className="w-12 h-12 object-cover rounded border" />}
            </div>
            <NativeMediaField
              label="Variant Main Image"
              value={variant.image ?? ''}
              entityType="product_variant"
              entityId={variant.id}
              helperText="Select the image that should appear when this variant or attribute-option combination is selected."
              onChange={(image) => saveVariantMedia(variant, { image })}
            />
            <NativeMediaField
              label="Variant Gallery Images"
              value={variant.galleryImages ?? []}
              multiple
              entityType="product_variant"
              entityId={variant.id}
              helperText="Optional extra images for this variant."
              onChange={(galleryImages) => saveVariantMedia(variant, { galleryImages })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── BundleTab ────────────────────────────────────────────────────────────────
function BundleTab({ productId }: { productId: number | null }) {
  const utils = trpc.useUtils();
  const { data: productById } = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const variants = productById?.variants ?? [];

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [newComponentId, setNewComponentId] = useState('');
  const [newQty, setNewQty] = useState('1');

  const { data: bundleItems, refetch: refetchBundle } = trpc.products.getBundleItems.useQuery(
    { bundleVariantId: selectedVariantId! },
    { enabled: !!selectedVariantId }
  );

  const upsertBundleMutation = trpc.products.upsertBundleItem.useMutation({
    onSuccess: () => { toast.success('Bundle item saved'); refetchBundle(); setNewComponentId(''); setNewQty('1'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBundleMutation = trpc.products.deleteBundleItem.useMutation({
    onSuccess: () => { toast.success('Bundle item removed'); refetchBundle(); },
    onError: (e) => toast.error(e.message),
  });

  if (!productId) return <p className="text-sm text-muted-foreground">Save the product first.</p>;

  return (
    <Card>
      <CardHeader><CardTitle>Bundle Components</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants found. Add variants first.</p>
        ) : (
          <>
            <div className="space-y-1">
              <Label>Select variant to configure</Label>
              <Select
                value={selectedVariantId ? String(selectedVariantId) : ''}
                onValueChange={(v) => setSelectedVariantId(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Pick a variant" /></SelectTrigger>
                <SelectContent>
                  {variants.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVariantId && (
              <div className="space-y-3">
                {bundleItems && bundleItems.length > 0 ? (
                  <div className="space-y-2">
                    {bundleItems.map((bi: any) => (
                      <div key={bi.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                        <span>{bi.productName} — {bi.variantName} (×{bi.qty})</span>
                        <Button
                          size="sm" variant="ghost" className="text-destructive h-6 px-2"
                          onClick={() => deleteBundleMutation.mutate({ id: bi.id })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No components yet.</p>
                )}

                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label>Component Variant ID</Label>
                    <Input
                      type="number"
                      value={newComponentId}
                      onChange={(e) => setNewComponentId(e.target.value)}
                      placeholder="Variant ID"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newComponentId) return;
                      upsertBundleMutation.mutate({
                        bundleVariantId: selectedVariantId!,
                        componentVariantId: Number(newComponentId),
                        qty: String(Number(newQty) || 1),
                      });
                    }}
                    disabled={upsertBundleMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-1" />Add
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── VendorsTab ───────────────────────────────────────────────────────────────
function VendorsTab({ productId }: { productId: number | null }) {
  const utils = trpc.useUtils();
  const { data: allVendors = [] } = trpc.vendors.list.useQuery();
  const { data: assigned = [] } = trpc.vendors.listByProduct.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );
  const [form, setForm] = useState({ vendorId: '', ownershipType: 'own' as 'own' | 'consignment' | 'commission', commissionPercent: '', notes: '' });

  const assignMutation = trpc.vendors.assignToProduct.useMutation({
    onSuccess: () => {
      utils.vendors.listByProduct.invalidate({ productId: productId! });
      setForm({ vendorId: '', ownershipType: 'own', commissionPercent: '', notes: '' });
      toast.success('Vendor assigned');
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMutation = trpc.vendors.removeFromProduct.useMutation({
    onSuccess: () => utils.vendors.listByProduct.invalidate({ productId: productId! }),
    onError: (e) => toast.error(e.message),
  });

  const availableVendors = (allVendors as any[]).filter((v: any) => !(assigned as any[]).some((a: any) => a.vendorId === v.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 size={16} /> Vendor Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(assigned as any[]).length > 0 ? (
          <div className="space-y-2">
            {(assigned as any[]).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{a.vendorName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.ownershipType}{a.commissionPercent && Number(a.commissionPercent) > 0 ? ` · ${a.commissionPercent}% commission` : ''}</p>
                  {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate({ id: a.id })}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No vendors assigned to this product.</p>
        )}

        {availableVendors.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Assign Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Select value={form.vendorId} onValueChange={(v) => setForm({ ...form, vendorId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((v: any) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ownership Type</Label>
                <Select value={form.ownershipType} onValueChange={(v) => setForm({ ...form, ownershipType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Own Stock</SelectItem>
                    <SelectItem value="consignment">Consignment</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.ownershipType === 'commission' && (
                <div className="space-y-1">
                  <Label>Commission %</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} placeholder="0.00" />
                </div>
              )}
              <div className="space-y-1 col-span-2">
                <Label>Notes (optional)</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. exclusive supplier" />
              </div>
            </div>
            <Button
              onClick={() => assignMutation.mutate({
                productId: productId!,
                vendorId: Number(form.vendorId),
                ownershipType: form.ownershipType,
                commissionPercent: form.commissionPercent ? Number(form.commissionPercent) : undefined,
                notes: form.notes || undefined,
              })}
              disabled={!form.vendorId || assignMutation.isPending}
              size="sm"
            >
              {assignMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
              Assign Vendor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CustomBoxTab ─────────────────────────────────────────────────────────────
function CustomBoxTab({ productId }: { productId: number | null }) {
  const [minItems, setMinItems] = useState(1);
  const [maxItems, setMaxItems] = useState(10);
  const [allowedVariantIds, setAllowedVariantIds] = useState<number[]>([]);

  const { data: config, isLoading: configLoading } = trpc.customBox.getConfig.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );
  useEffect(() => {
    if (config) {
      setMinItems((config as any).minItems ?? 1);
      setMaxItems((config as any).maxItems ?? 10);
      setAllowedVariantIds((config as any).allowedVariantIds ?? []);
    }
  }, [config]);

  const { data: variants = [], isLoading: variantsLoading } = trpc.customBox.getVariants.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );
  const setConfigMutation = trpc.customBox.setConfig.useMutation({
    onSuccess: () => toast.success('Custom box config saved'),
    onError: (e: any) => toast.error(e.message),
  });

  if (!productId) return <p className="text-sm text-muted-foreground">Save the product first to configure custom box rules.</p>;
  if (configLoading || variantsLoading) return <div className="flex items-center gap-2 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm text-muted-foreground">Loading...</span></div>;

  const toggleVariant = (id: number) => {
    setAllowedVariantIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom Box Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">Define how many items customers can select and which variants are available.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Minimum Items</Label>
            <Input
              type="number" min={1} max={maxItems}
              value={minItems}
              onChange={e => setMinItems(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label>Maximum Items</Label>
            <Input
              type="number" min={minItems}
              value={maxItems}
              onChange={e => setMaxItems(Math.max(minItems, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Allowed Variants ({allowedVariantIds.length === 0 ? 'All variants allowed' : `${allowedVariantIds.length} selected`})</Label>
          <p className="text-xs text-muted-foreground">Leave all unchecked to allow all variants. Check specific variants to restrict selection.</p>
          {(variants as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No variants found. Add variants first.</p>
          ) : (
            <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
              {(variants as any[]).map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer" onClick={() => toggleVariant(v.id)}>
                  <input
                    type="checkbox"
                    checked={allowedVariantIds.includes(v.id)}
                    onChange={() => toggleVariant(v.id)}
                    className="h-4 w-4 rounded border-gray-300"
                    onClick={e => e.stopPropagation()}
                  />
                  {v.image && <img src={v.image} alt={v.name} className="w-8 h-8 object-cover rounded" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    {v.sku && <p className="text-xs text-muted-foreground">SKU: {v.sku}</p>}
                  </div>
                  <span className="text-sm text-muted-foreground">{parseFloat(String(v.price)).toFixed(3)} KWD</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={() => setConfigMutation.mutate({ productId: productId!, minItems, maxItems, allowedVariantIds })}
          disabled={setConfigMutation.isPending}
        >
          {setConfigMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
          Save Custom Box Config
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── AttributesTab ────────────────────────────────────────────────────────────
function AttributesTab({ productId }: { productId: number | null }) {
  const utils = trpc.useUtils();

  // All global attributes
  const { data: allAttributes = [], isLoading: attrsLoading } = trpc.attributes.list.useQuery();

  // Attributes already assigned to this product
  const { data: productAttributes = [], isLoading: paLoading } = trpc.attributes.getProductAttributes.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  const [pendingAssignments, setPendingAssignments] = useState<{ attributeId: number; activeValueIds: number[]; sortOrder: number; isImageMaster?: boolean }[]>([]);

  // Sync pending assignments from loaded data
  useEffect(() => {
    if ((productAttributes as any[]).length > 0) {
      setPendingAssignments(
        (productAttributes as any[]).map((pa: any, i: number) => ({
          attributeId: pa.attributeId,
          activeValueIds: pa.activeValueIds ?? [],
          sortOrder: i,
          isImageMaster: pa.isImageMaster === true,
        }))
      );
    }
  }, [JSON.stringify(productAttributes)]);

  const { data: productById } = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const variants = (productById as any)?.variants ?? [];

  const setAttributesMutation = trpc.attributes.setProductAttributes.useMutation({
    onSuccess: (result: any) => {
      const sync = result?.variantSync;
      if (sync) {
        toast.success(`Attributes saved. Variant matrix: ${sync.generated} expected, ${sync.created} created, ${sync.updated} updated, ${sync.skipped} preserved.`);
      } else {
        toast.success('Attributes saved');
      }
      utils.attributes.getProductAttributes.invalidate({ productId: productId! });
      utils.products.byId.invalidate({ id: productId! });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!productId) {
    return <p className="text-sm text-muted-foreground">Save the product first to assign attributes.</p>;
  }

  if (attrsLoading || paLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm text-muted-foreground">Loading attributes...</span>
      </div>
    );
  }

  const assignedIds = new Set(pendingAssignments.map((pa) => pa.attributeId));
  // P8: only global attributes participate in variant generation
  const globalAttributes = (allAttributes as any[]).filter((a: any) => (a.type ?? 'global') === 'global');
  const customAttributes = (allAttributes as any[]).filter((a: any) => a.type === 'custom');
  const unassigned = globalAttributes.filter((a: any) => !assignedIds.has(a.id));

  const addAttribute = (attributeId: number) => {
    setPendingAssignments(prev => [...prev, { attributeId, activeValueIds: [], sortOrder: prev.length, isImageMaster: false }]);
  };

  const removeAttribute = (attributeId: number) => {
    setPendingAssignments(prev => prev.filter(pa => pa.attributeId !== attributeId));
  };

  const setImageMasterAttribute = (attributeId: number | null) => {
    setPendingAssignments(prev => prev.map(pa => ({ ...pa, isImageMaster: attributeId !== null && pa.attributeId === attributeId })));
  };

  const setActiveValues = (attributeId: number, valueIds: number[]) => {
    const clean = Array.from(new Set(valueIds.map(Number).filter(Number.isFinite)));
    setPendingAssignments(prev => prev.map(pa => (pa.attributeId === attributeId ? { ...pa, activeValueIds: clean } : pa)));
  };

  const toggleActiveValue = (attributeId: number, valueId: number) => {
    setPendingAssignments(prev => prev.map(pa => {
      if (pa.attributeId !== attributeId) return pa;
      const current = new Set(pa.activeValueIds ?? []);
      current.has(valueId) ? current.delete(valueId) : current.add(valueId);
      return { ...pa, activeValueIds: Array.from(current) };
    }));
  };

  const activeAttributeCounts = pendingAssignments.map((pa) => (pa.activeValueIds ?? []).length);
  const expectedVariantCount = activeAttributeCounts.length > 0 && activeAttributeCounts.every((count) => count > 0)
    ? activeAttributeCounts.reduce((total, count) => total * count, 1)
    : 0;
  const hasIncompleteSelection = pendingAssignments.some((pa) => (pa.activeValueIds ?? []).length === 0);

  const saveAssignments = () => {
    setAttributesMutation.mutate({ productId: productId!, assignments: pendingAssignments, syncVariants: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sliders size={16} />
          Product Attributes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign global attributes to this product. Customers will see these as selectors on the product page. Choose one image master attribute, such as Color, when its selected values should control the main product image and gallery.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned attributes */}
        {pendingAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No attributes assigned yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setImageMasterAttribute(null)}>
                No image master
              </Button>
            </div>
            {pendingAssignments.map((pa) => {
              const attr = (allAttributes as any[]).find((a: any) => a.id === pa.attributeId);
              const values = ((attr?.values ?? []) as any[]).filter((v: any) => v.isEnabled !== false);
              const selectedIds = pa.activeValueIds ?? [];
              return (
                <div key={pa.attributeId} className="space-y-3 px-3 py-3 border rounded-md bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{attr?.name ?? `Attribute #${pa.attributeId}`}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(attr?.displayType ?? 'button')} selector · {selectedIds.length} of {values.length} values selected for variant generation
                      </p>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="radio"
                          name={`image-master-${productId}`}
                          checked={pa.isImageMaster === true}
                          onChange={() => setImageMasterAttribute(pa.attributeId)}
                          className="h-3.5 w-3.5"
                        />
                        Use this attribute as product image master
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAttribute(pa.attributeId)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {values.length === 0 ? (
                    <p className="text-xs text-destructive">This attribute has no enabled values. Add enabled values before syncing variants.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setActiveValues(pa.attributeId, values.map((v: any) => v.id))}>
                          Select all values
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setActiveValues(pa.attributeId, [])}>
                          Clear values
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {values.map((value: any) => {
                          const checked = selectedIds.includes(value.id);
                          return (
                            <label
                              key={value.id}
                              className={`flex items-center gap-3 rounded-md border p-2 text-sm cursor-pointer transition ${checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleActiveValue(pa.attributeId, value.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              {value.image ? (
                                <img src={value.image} alt={value.labelEn} className="h-8 w-8 rounded object-cover border" />
                              ) : value.swatch ? (
                                <span className="h-8 w-8 rounded border" style={{ backgroundColor: value.swatch }} />
                              ) : (
                                <span className="h-8 w-8 rounded border bg-muted" />
                              )}
                              <span className="min-w-0 flex-1 truncate">{value.labelEn}</span>
                              {value.price && <span className="text-xs text-muted-foreground">{value.price} KWD</span>}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add attribute */}
        {unassigned.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Attribute</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((a: any) => (
                <Button
                  key={a.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addAttribute(a.id)}
                >
                  <Plus size={12} className="mr-1" />
                  {a.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {globalAttributes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No global attributes found.{' '}
            <a href="/admin/attributes" className="underline text-primary">Create attributes first</a>.
          </p>
        )}

        {/* Custom attributes — display-only, do not generate variants */}
        {customAttributes.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Attributes (display-only)</p>
            <p className="text-xs text-muted-foreground">These attributes are shown on the product page but do not generate variants.</p>
            <div className="flex flex-wrap gap-2">
              {customAttributes.map((a: any) => (
                <span key={a.id} className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-muted/30 text-muted-foreground">
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="space-y-3 pt-2 border-t">
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Variant sync preview</p>
            <p className="text-muted-foreground">
              Saving will synchronize the variant matrix from the selected attribute values. Expected combinations: <strong>{expectedVariantCount}</strong>. Existing manually edited variant price, image, SKU, and stock data is preserved where already present. Only the selected image master attribute seeds product/variant imagery.
            </p>
            {hasIncompleteSelection && pendingAssignments.length > 0 && (
              <p className="mt-1 text-xs text-destructive">Select at least one value for every assigned global attribute before expecting variants to be generated.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Current saved variant rows: {variants.length}</p>
          </div>
          <Button onClick={saveAssignments} disabled={setAttributesMutation.isPending}>
            {setAttributesMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
            Save Attributes & Sync Variants
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PreOrderTab ─────────────────────────────────────────────────────────────
function PreOrderTab({ productId }: { productId: number | null }) {
  const utils = trpc.useUtils();
  const { data: productById, isLoading } = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const variants = productById?.variants ?? [];

  const upsertVariantMutation = trpc.products.upsertVariant.useMutation({
    onSuccess: () => {
      toast.success('Pre-order settings saved');
      utils.products.byId.invalidate({ id: productId! });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!productId) return <p className="text-sm text-muted-foreground">Save the product first.</p>;
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-Order Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enable pre-order on specific variants. When enabled and stock is zero, customers can still place orders up to the configured limit.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants found for this product.</p>
        ) : (
          variants.map((v: any) => (
            <PreOrderVariantRow
              key={v.id}
              variant={v}
              productId={productId!}
              onSave={(data) => upsertVariantMutation.mutate(data)}
              isSaving={upsertVariantMutation.isPending}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PreOrderVariantRow({
  variant, productId, onSave, isSaving
}: {
  variant: any;
  productId: number;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [enabled, setEnabled] = useState<boolean>(variant.preOrderEnabled ?? false);
  const [limit, setLimit] = useState<string>(String(variant.preOrderLimit ?? 0));

  useEffect(() => {
    setEnabled(variant.preOrderEnabled ?? false);
    setLimit(String(variant.preOrderLimit ?? 0));
  }, [variant.preOrderEnabled, variant.preOrderLimit]);

  const handleSave = () => {
    onSave({
      id: variant.id,
      productId,
      name: variant.name,
      price: variant.price ?? '0.000',
      sku: variant.sku ?? undefined,
      salePrice: variant.salePrice ?? undefined,
      cog: variant.cog ?? undefined,
      attributes: variant.attributes ?? {},
      image: variant.image ?? undefined,
      weight: variant.weight ?? undefined,
      isActive: variant.isActive ?? true,
      preOrderEnabled: enabled,
      preOrderLimit: Number(limit) || 0,
    });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{variant.name}</p>
          {variant.sku && <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Pre-order</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      {enabled && (
        <div className="flex items-end gap-3">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Pre-order Limit (max units)</Label>
            <Input
              type="number"
              min="0"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            Used: {variant.preOrderUsed ?? 0} / {limit || 0}
          </div>
        </div>
      )}
      <Button size="sm" onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
        Save
      </Button>
    </div>
  );
}
