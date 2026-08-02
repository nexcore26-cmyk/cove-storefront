import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Layers,
  Package,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import NativeMediaField from "@/components/admin/NativeMediaField";

// ─── Types ────────────────────────────────────────────────────────────────────
type BundleItem = {
  productId: number;
  qty: number;
  productName?: string;
};

type AttributeValue = {
  id: number;
  attributeId: number;
  labelEn: string;
  labelAr?: string | null;
  swatch?: string | null;
  image?: string | null;
  galleryImages?: string[] | null;
  price?: string | null;
  salePrice?: string | null;
  costOfGoods?: string | null;
  shippingClass?: string | null;
  weight?: string | null;
  dimensionL?: string | null;
  dimensionW?: string | null;
  dimensionH?: string | null;
  manageStock: boolean;
  isBundle: boolean;
  isEnabled: boolean;
  sortOrder: number;
  bundleItems?: BundleItem[];
};

type Attribute = {
  id: number;
  name: string;
  displayType: "button" | "color" | "image";
  // P8: global = participates in variant generation; custom = display-only
  type: "global" | "custom";
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  sortOrder: number;
  values: AttributeValue[];
};

// ─── Empty forms ────────────────────────────────────────────────────────────────────────────────
const EMPTY_ATTR = {
  name: "",
  displayType: "button" as "button" | "color" | "image",
  type: "global" as "global" | "custom",
  descriptionEn: "",
  descriptionAr: "",
  sortOrder: 0,
};

const EMPTY_VALUE = {
  labelEn: "",
  labelAr: "",
  swatch: "",
  image: "",
  price: "",
  salePrice: "",
  costOfGoods: "",
  shippingClass: "",
  shippingClassId: null as number | null,
  weight: "",
  dimensionL: "",
  dimensionW: "",
  dimensionH: "",
  manageStock: false,
  isBundle: false,
  isEnabled: true,
  sortOrder: 0,
  bundleItems: [] as { productId: number; qty: number; productName: string }[],
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminAttributes() {
  const utils = trpc.useUtils();

  const { data: attributes = [], isLoading } = trpc.attributes.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery({ limit: 500 });
  const { data: shippingClasses = [] } = trpc.shipping.listShippingClasses.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  // A1: Admin language setting — controls which label language is shown
  const { data: storeSettings } = trpc.settings.get.useQuery();
  const adminLang: 'en' | 'ar' = (storeSettings as any)?.adminLanguage ?? 'en';

  // Attribute dialog
  const [attrDialog, setAttrDialog] = useState(false);
  const [editAttrId, setEditAttrId] = useState<number | null>(null);
  const [attrForm, setAttrForm] = useState({ ...EMPTY_ATTR });
  const [deleteAttrId, setDeleteAttrId] = useState<number | null>(null);

  // Value dialog
  const [valueDialog, setValueDialog] = useState(false);
  const [editValueId, setEditValueId] = useState<number | null>(null);
  const [valueAttrId, setValueAttrId] = useState<number | null>(null);
  const [valueForm, setValueForm] = useState({ ...EMPTY_VALUE });
  const [deleteValueId, setDeleteValueId] = useState<number | null>(null);

  // Bundle product search
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleQty, setBundleQty] = useState(1);
  const [bundleProductId, setBundleProductId] = useState<number | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const createAttr = trpc.attributes.create.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Attribute created"); setAttrDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateAttr = trpc.attributes.update.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Attribute updated"); setAttrDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAttr = trpc.attributes.delete.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Attribute deleted"); setDeleteAttrId(null); },
    onError: (e) => toast.error(e.message),
  });
  const createValue = trpc.attributes.createValue.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Value added"); setValueDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateValue = trpc.attributes.updateValue.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Value updated"); setValueDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteValue = trpc.attributes.deleteValue.useMutation({
    onSuccess: () => { utils.attributes.list.invalidate(); toast.success("Value deleted"); setDeleteValueId(null); },
    onError: (e) => toast.error(e.message),
  });

  // ── Attribute dialog handlers ─────────────────────────────────────────────
  function openCreateAttr() {
    setEditAttrId(null);
    setAttrForm({ ...EMPTY_ATTR });
    setAttrDialog(true);
  }
  function openEditAttr(attr: Attribute) {
    setEditAttrId(attr.id);
    setAttrForm({
      name: attr.name,
      displayType: attr.displayType,
      type: attr.type ?? "global",
      descriptionEn: attr.descriptionEn ?? "",
      descriptionAr: attr.descriptionAr ?? "",
      sortOrder: attr.sortOrder,
    });
    setAttrDialog(true);
  }
  function submitAttr() {
    const payload = {
      name: attrForm.name,
      displayType: attrForm.displayType,
      type: attrForm.type,
      descriptionEn: attrForm.descriptionEn || undefined,
      descriptionAr: attrForm.descriptionAr || undefined,
      sortOrder: attrForm.sortOrder,
    };
    if (editAttrId) updateAttr.mutate({ id: editAttrId, ...payload });
    else createAttr.mutate(payload);
  }

  // ── Value dialog handlers ─────────────────────────────────────────────────
  function openCreateValue(attrId: number) {
    setEditValueId(null);
    setValueAttrId(attrId);
    setValueForm({ ...EMPTY_VALUE });
    setBundleSearch("");
    setBundleQty(1);
    setBundleProductId(null);
    setValueDialog(true);
  }
  function openEditValue(val: AttributeValue, attrId: number) {
    setEditValueId(val.id);
    setValueAttrId(attrId);
    setValueForm({
      labelEn: val.labelEn,
      labelAr: val.labelAr ?? "",
      swatch: val.swatch ?? "",
      image: val.image ?? "",
      price: val.price ?? "",
      salePrice: val.salePrice ?? "",
      costOfGoods: val.costOfGoods ?? "",
      shippingClass: val.shippingClass ?? "",
      shippingClassId: (val as any).shippingClassId ?? null,
      weight: val.weight ?? "",
      dimensionL: val.dimensionL ?? "",
      dimensionW: val.dimensionW ?? "",
      dimensionH: val.dimensionH ?? "",
      manageStock: val.manageStock,
      isBundle: val.isBundle,
      isEnabled: val.isEnabled,
      sortOrder: val.sortOrder,
      bundleItems: (val.bundleItems ?? []).map((bi) => ({
        productId: bi.productId,
        qty: bi.qty,
        productName: bi.productName ?? "",
      })),
    });
    setBundleSearch("");
    setBundleQty(1);
    setBundleProductId(null);
    setValueDialog(true);
  }
  function submitValue() {
    if (!valueAttrId) return;
    const payload = {
      attributeId: valueAttrId,
      labelEn: valueForm.labelEn,
      labelAr: valueForm.labelAr || undefined,
      swatch: valueForm.swatch || undefined,
      image: valueForm.image || undefined,
      price: valueForm.price || undefined,
      salePrice: valueForm.salePrice || undefined,
      costOfGoods: valueForm.costOfGoods || undefined,
      shippingClass: valueForm.shippingClass || undefined,
      shippingClassId: valueForm.shippingClassId ?? undefined,
      weight: valueForm.weight || undefined,
      dimensionL: valueForm.dimensionL || undefined,
      dimensionW: valueForm.dimensionW || undefined,
      dimensionH: valueForm.dimensionH || undefined,
      manageStock: valueForm.manageStock,
      isBundle: valueForm.isBundle,
      isEnabled: valueForm.isEnabled,
      sortOrder: valueForm.sortOrder,
      bundleItems: valueForm.isBundle ? valueForm.bundleItems.map((bi) => ({
        productId: bi.productId,
        qty: bi.qty,
      })) : [],
    };
    if (editValueId) updateValue.mutate({ id: editValueId, ...payload });
    else createValue.mutate(payload);
  }

  function addBundleItem() {
    if (!bundleProductId) return;
    const prod = (products as any).items?.find((p: any) => p.id === bundleProductId)
      || (Array.isArray(products) ? products : []).find((p: any) => p.id === bundleProductId);
    setValueForm((f) => ({
      ...f,
      bundleItems: [
        ...f.bundleItems.filter((bi) => bi.productId !== bundleProductId),
        { productId: bundleProductId, qty: bundleQty, productName: prod?.name ?? "" },
      ],
    }));
    setBundleProductId(null);
    setBundleQty(1);
    setBundleSearch("");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const displayTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      button: "bg-blue-100 text-blue-800",
      color: "bg-orange-100 text-orange-800",
      image: "bg-purple-100 text-purple-800",
    };
    return map[type] ?? "bg-gray-100 text-gray-600";
  };

  const productList = (products as any).items ?? (Array.isArray(products) ? products : []);
  const filteredProducts = bundleSearch
    ? productList.filter((p: any) =>
        p.name?.toLowerCase().includes(bundleSearch.toLowerCase())
      )
    : productList.slice(0, 20);

  const isSavingAttr = createAttr.isPending || updateAttr.isPending;
  const isSavingValue = createValue.isPending || updateValue.isPending;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Product Attributes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define variant selectors (color, size, set options) used across products
            </p>
          </div>
          <Button onClick={openCreateAttr}>
            <Plus className="w-4 h-4 mr-2" />
            Add Attribute
          </Button>
        </div>

        {/* Attribute list */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (attributes as Attribute[]).length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
            No attributes yet. Click "Add Attribute" to create your first one.
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {(attributes as Attribute[]).map((attr) => (
              <AccordionItem
                key={attr.id}
                value={String(attr.id)}
                className="border border-border rounded-lg overflow-hidden"
              >
                <div className="flex items-center">
                  <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{attr.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${displayTypeBadge(attr.displayType)}`}>
                        {attr.displayType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {attr.values.length} value{attr.values.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex gap-1 px-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditAttr(attr)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteAttrId(attr.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <AccordionContent className="px-4 pb-4 pt-2">
                  {attr.descriptionEn && (
                    <p className="text-xs text-muted-foreground mb-3 bg-muted/30 rounded p-2">
                      {attr.descriptionEn}
                    </p>
                  )}
                  {/* Values table */}
                  <div className="border border-border rounded-md overflow-hidden mb-3">
                    {attr.values.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No values yet
                      </div>
                    ) : (
                      attr.values.map((val) => (
                        <div
                          key={val.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/20"
                        >
                          {/* Swatch / image preview */}
                          {attr.displayType === "color" && val.swatch && (
                            <div
                              className="w-5 h-5 rounded-full border shrink-0"
                              style={{ backgroundColor: val.swatch }}
                            />
                          )}
                          {attr.displayType === "image" && val.image && (
                            <img
                              src={val.image}
                              alt=""
                              className="w-8 h-8 object-cover rounded border shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* A1: Show only the label matching the admin language */}
                              <span className="text-sm font-medium" dir={adminLang === 'ar' ? 'rtl' : 'ltr'}>
                                {adminLang === 'ar' ? (val.labelAr || val.labelEn) : val.labelEn}
                              </span>
                              {val.isBundle && (
                                <Badge variant="outline" className="text-xs">Bundle</Badge>
                              )}
                              {!val.isEnabled && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                              {val.price && <span>Price: {val.price} KWD</span>}
                              {val.manageStock && <span>Manage stock</span>}
                              {val.isBundle && val.bundleItems && val.bundleItems.length > 0 && (
                                <span>
                                  {val.bundleItems.map((bi) => `${bi.qty}× ${bi.productName || `#${bi.productId}`}`).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditValue(val, attr.id)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteValueId(val.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCreateValue(attr.id)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Value
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* ── Attribute Dialog ─────────────────────────────────────────────── */}
        <Dialog open={attrDialog} onOpenChange={setAttrDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editAttrId ? "Edit Attribute" : "New Attribute"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Attribute Name (system reference) *</Label>
                <Input
                  value={attrForm.name}
                  onChange={(e) => setAttrForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Select color, Select mubkhar set"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display Type</Label>
                <Select
                  value={attrForm.displayType}
                  onValueChange={(v) => setAttrForm((f) => ({ ...f, displayType: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="button">Button (radio / text options)</SelectItem>
                    <SelectItem value="color">Color swatch</SelectItem>
                    <SelectItem value="image">Image swatch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Attribute Type</Label>
                <Select
                  value={attrForm.type}
                  onValueChange={(v) => setAttrForm((f) => ({ ...f, type: v as "global" | "custom" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global — participates in variant generation</SelectItem>
                    <SelectItem value="custom">Custom — display-only, does not generate variants</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Global attributes are used to generate product variants. Custom attributes are shown on the product page but do not create separate variants.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Description (English) — shown on storefront</Label>
                <Textarea
                  value={attrForm.descriptionEn}
                  onChange={(e) => setAttrForm((f) => ({ ...f, descriptionEn: e.target.value }))}
                  rows={3}
                  placeholder="HTML allowed. Shown when a value is selected."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (Arabic)</Label>
                <Textarea
                  value={attrForm.descriptionAr}
                  onChange={(e) => setAttrForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                  rows={3}
                  dir="rtl"
                  placeholder="HTML allowed."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={attrForm.sortOrder}
                  onChange={(e) => setAttrForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttrDialog(false)}>Cancel</Button>
              <Button onClick={submitAttr} disabled={isSavingAttr || !attrForm.name}>
                {isSavingAttr ? "Saving…" : editAttrId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Value Dialog ─────────────────────────────────────────────────── */}
        <Dialog open={valueDialog} onOpenChange={setValueDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editValueId ? "Edit Value" : "Add Value"}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="mt-2">
              <TabsList className="mb-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="shipping">Shipping & Dimensions</TabsTrigger>
                {valueForm.isBundle && <TabsTrigger value="bundle">Bundle Items</TabsTrigger>}
              </TabsList>

              {/* General tab */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Label (English) *</Label>
                    <Input
                      value={valueForm.labelEn}
                      onChange={(e) => setValueForm((f) => ({ ...f, labelEn: e.target.value }))}
                      placeholder="e.g. Gold, Roshina only"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Label (Arabic)</Label>
                    <Input
                      value={valueForm.labelAr}
                      onChange={(e) => setValueForm((f) => ({ ...f, labelAr: e.target.value }))}
                      dir="rtl"
                      placeholder="e.g. ذهبي"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Swatch (hex color or URL)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={valueForm.swatch}
                        onChange={(e) => setValueForm((f) => ({ ...f, swatch: e.target.value }))}
                        placeholder="#c8a96e or https://…"
                      />
                      {valueForm.swatch?.startsWith("#") && (
                        <div
                          className="w-10 h-10 rounded border shrink-0"
                          style={{ backgroundColor: valueForm.swatch }}
                        />
                      )}
                    </div>
                  </div>
                  <NativeMediaField
                    label="Attribute Value Image"
                    value={valueForm.image}
                    entityType="attribute_value"
                    entityId={editValueId}
                    helperText="Upload or select a native Cove image for image swatches and option media."
                    onChange={(image) => setValueForm((f) => ({ ...f, image }))}
                  />
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={valueForm.isEnabled}
                      onCheckedChange={(v) => setValueForm((f) => ({ ...f, isEnabled: v }))}
                    />
                    <Label>Enabled</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={valueForm.isBundle}
                      onCheckedChange={(v) => setValueForm((f) => ({ ...f, isBundle: v }))}
                    />
                    <Label>Bundle (links multiple products)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={valueForm.manageStock}
                      onCheckedChange={(v) => setValueForm((f) => ({ ...f, manageStock: v }))}
                      disabled={valueForm.isBundle}
                    />
                    <Label className={valueForm.isBundle ? "text-muted-foreground" : ""}>
                      Manage stock
                    </Label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={valueForm.sortOrder}
                    onChange={(e) => setValueForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-24"
                  />
                </div>
              </TabsContent>

              {/* Pricing tab */}
              <TabsContent value="pricing" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Price (KWD)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={valueForm.price}
                      onChange={(e) => setValueForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sale Price (KWD)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={valueForm.salePrice}
                      onChange={(e) => setValueForm((f) => ({ ...f, salePrice: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost of Goods (KWD)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={valueForm.costOfGoods}
                      onChange={(e) => setValueForm((f) => ({ ...f, costOfGoods: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Shipping & Dimensions tab */}
              <TabsContent value="shipping" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Shipping Class Override</Label>
                    <Select
                      value={valueForm.shippingClassId ? String(valueForm.shippingClassId) : 'none'}
                      onValueChange={(v) => setValueForm((f) => ({ ...f, shippingClassId: v === 'none' ? null : Number(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Use product's class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use product's shipping class</SelectItem>
                        {(shippingClasses as any[]).map((sc) => (
                          <SelectItem key={sc.id} value={String(sc.id)}>
                            {sc.name} — KW: {sc.kuwaitCost} | GCC: {sc.gccCostPerUnit}×qty
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Override shipping class for this specific variant</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valueForm.weight}
                      onChange={(e) => setValueForm((f) => ({ ...f, weight: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Dimensions L × W × H (cm)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      type="number"
                      step="0.1"
                      value={valueForm.dimensionL}
                      onChange={(e) => setValueForm((f) => ({ ...f, dimensionL: e.target.value }))}
                      placeholder="Length"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={valueForm.dimensionW}
                      onChange={(e) => setValueForm((f) => ({ ...f, dimensionW: e.target.value }))}
                      placeholder="Width"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={valueForm.dimensionH}
                      onChange={(e) => setValueForm((f) => ({ ...f, dimensionH: e.target.value }))}
                      placeholder="Height"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Bundle Items tab */}
              {valueForm.isBundle && (
                <TabsContent value="bundle" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Define which products make up this bundle option and how many units of each are
                    required. Stock availability is computed as the minimum across all linked products.
                  </p>
                  {/* Current bundle items */}
                  {valueForm.bundleItems.length > 0 && (
                    <div className="border border-border rounded-md overflow-hidden">
                      {valueForm.bundleItems.map((bi, idx) => (
                        <div key={bi.productId} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0">
                          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm">{bi.productName || `Product #${bi.productId}`}</span>
                          <span className="text-sm font-medium">{bi.qty}×</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setValueForm((f) => ({
                              ...f,
                              bundleItems: f.bundleItems.filter((_, i) => i !== idx),
                            }))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add product to bundle */}
                  <div className="border border-dashed border-border rounded-md p-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add product to bundle</p>
                    <Input
                      placeholder="Search products…"
                      value={bundleSearch}
                      onChange={(e) => setBundleSearch(e.target.value)}
                    />
                    {filteredProducts.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-border rounded-md">
                        {filteredProducts.map((p: any) => (
                          <div
                            key={p.id}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${bundleProductId === p.id ? "bg-primary/10 font-medium" : ""}`}
                            onClick={() => setBundleProductId(p.id)}
                          >
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <div className="space-y-1.5 w-24">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={bundleQty}
                          onChange={(e) => setBundleQty(Number(e.target.value))}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addBundleItem}
                        disabled={!bundleProductId}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add to bundle
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setValueDialog(false)}>Cancel</Button>
              <Button onClick={submitValue} disabled={isSavingValue || !valueForm.labelEn}>
                {isSavingValue ? "Saving…" : editValueId ? "Update" : "Add Value"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Attribute Confirm */}
        <AlertDialog open={!!deleteAttrId} onOpenChange={(o) => !o && setDeleteAttrId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Attribute?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the attribute and all its values. Products using this
                attribute will lose their variant configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteAttrId && deleteAttr.mutate({ id: deleteAttrId })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Value Confirm */}
        <AlertDialog open={!!deleteValueId} onOpenChange={(o) => !o && setDeleteValueId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Value?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this attribute value.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteValueId && deleteValue.mutate({ id: deleteValueId })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
