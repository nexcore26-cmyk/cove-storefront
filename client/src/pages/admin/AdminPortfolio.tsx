/**
 * AdminPortfolio — Portfolio Module Admin UI
 *
 * Two-panel layout:
 *  Left: Portfolio Categories (create, edit, delete, type: portfolio/events)
 *  Right: Portfolio Items for selected category (create, edit, delete, with images)
 *
 * Each item supports: title EN/AR, description EN/AR, cover image, video URL, gallery images
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, FolderOpen, Image, X, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import NativeMediaField from "@/components/admin/NativeMediaField";

type Category = {
  id: number;
  slug: string;
  name: string;
  nameAr?: string | null;
  type: "portfolio" | "events";
  sortOrder: number;
  isVisible: boolean;
};

type PortfolioItem = {
  id: number;
  categoryId: number;
  slug: string;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  coverImage?: string | null;
  videoUrl?: string | null;
  sortOrder: number;
  isVisible: boolean;
};

type PortfolioImage = {
  id: number;
  itemId: number;
  url: string;
  altText?: string | null;
  sortOrder: number;
};

const EMPTY_CAT = { name: "", nameAr: "", type: "portfolio" as "portfolio" | "events", sortOrder: 0, isVisible: true };
const EMPTY_ITEM = { title: "", titleAr: "", description: "", descriptionAr: "", coverImage: "", videoUrl: "", sortOrder: 0, isVisible: true };

export default function AdminPortfolio() {
  const utils = trpc.useUtils();

  // ── Category state ──────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = trpc.portfolio.listCategories.useQuery({ type: "all" });
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [catDialog, setCatDialog] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [catForm, setCatForm] = useState({ ...EMPTY_CAT });

  const createCat = trpc.portfolio.createCategory.useMutation({
    onSuccess: () => { utils.portfolio.listCategories.invalidate(); toast.success("Category created"); setCatDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateCat = trpc.portfolio.updateCategory.useMutation({
    onSuccess: () => { utils.portfolio.listCategories.invalidate(); toast.success("Category updated"); setCatDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCat = trpc.portfolio.deleteCategory.useMutation({
    onSuccess: () => { utils.portfolio.listCategories.invalidate(); toast.success("Category deleted"); setDeleteCatId(null); if (selectedCatId === deleteCatId) setSelectedCatId(null); },
    onError: (e) => toast.error(e.message),
  });

  function openNewCat() { setCatForm({ ...EMPTY_CAT }); setEditingCatId(null); setCatDialog(true); }
  function openEditCat(cat: Category) { setCatForm({ name: cat.name, nameAr: cat.nameAr ?? "", type: cat.type, sortOrder: cat.sortOrder, isVisible: cat.isVisible }); setEditingCatId(cat.id); setCatDialog(true); }
  function saveCat() {
    if (!catForm.name.trim()) return toast.error("Name is required");
    if (editingCatId) updateCat.mutate({ id: editingCatId, ...catForm });
    else createCat.mutate(catForm);
  }

  // ── Item state ──────────────────────────────────────────────────────────────
  const { data: items = [], isLoading: itemsLoading } = trpc.portfolio.adminListItems.useQuery(
    { categoryId: selectedCatId ?? undefined },
    { enabled: selectedCatId !== null }
  );
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM });
  const [itemImages, setItemImages] = useState<{ url: string; altText: string; sortOrder: number }[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const createItem = trpc.portfolio.createItem.useMutation({
    onSuccess: () => { utils.portfolio.adminListItems.invalidate(); toast.success("Portfolio item created"); setItemDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.portfolio.updateItem.useMutation({
    onSuccess: () => { utils.portfolio.adminListItems.invalidate(); toast.success("Portfolio item updated"); setItemDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteItem = trpc.portfolio.deleteItem.useMutation({
    onSuccess: () => { utils.portfolio.adminListItems.invalidate(); toast.success("Item deleted"); setDeleteItemId(null); },
    onError: (e) => toast.error(e.message),
  });

  // Image management for existing items
  const addImage = trpc.portfolio.addImage.useMutation({
    onSuccess: () => { utils.portfolio.listImages.invalidate(); toast.success("Image added"); setNewImageUrl(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteImage = trpc.portfolio.deleteImage.useMutation({
    onSuccess: () => { utils.portfolio.listImages.invalidate(); toast.success("Image removed"); },
    onError: (e) => toast.error(e.message),
  });

  // Images for the item being edited
  const { data: editingImages = [] } = trpc.portfolio.listImages.useQuery(
    { itemId: editingItemId! },
    { enabled: editingItemId !== null }
  );

  function openNewItem() {
    if (!selectedCatId) return;
    setItemForm({ ...EMPTY_ITEM });
    setItemImages([]);
    setEditingItemId(null);
    setItemDialog(true);
  }
  function openEditItem(item: PortfolioItem) {
    setItemForm({
      title: item.title,
      titleAr: item.titleAr ?? "",
      description: item.description ?? "",
      descriptionAr: item.descriptionAr ?? "",
      coverImage: item.coverImage ?? "",
      videoUrl: item.videoUrl ?? "",
      sortOrder: item.sortOrder,
      isVisible: item.isVisible,
    });
    setItemImages([]);
    setEditingItemId(item.id);
    setItemDialog(true);
  }
  function saveItem() {
    if (!itemForm.title.trim()) return toast.error("Title is required");
    if (editingItemId) {
      updateItem.mutate({ id: editingItemId, ...itemForm });
    } else {
      createItem.mutate({
        categoryId: selectedCatId!,
        ...itemForm,
        images: itemImages,
      });
    }
  }

  const selectedCat = categories.find((c) => c.id === selectedCatId);

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Manage portfolio categories and items for Company Portfolio and Events pages</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Categories ─────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Categories</h2>
                <Button size="sm" variant="outline" onClick={openNewCat} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> New
                </Button>
              </div>
              <div className="divide-y divide-gray-100">
                {catsLoading && <div className="p-4 text-sm text-gray-400">Loading...</div>}
                {!catsLoading && categories.length === 0 && (
                  <div className="p-4 text-sm text-gray-400 text-center">No categories yet</div>
                )}
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCatId === cat.id ? "bg-amber-50 border-l-2 border-amber-600" : ""}`}
                  >
                    <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{cat.name}</div>
                      {cat.nameAr && <div className="text-xs text-gray-400 truncate" dir="rtl">{cat.nameAr}</div>}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {cat.type === "events" ? "Events" : "Portfolio"}
                    </Badge>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEditCat(cat as Category); }} className="p-1 rounded hover:bg-gray-100">
                        <Pencil className="w-3 h-3 text-gray-500" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteCatId(cat.id); }} className="p-1 rounded hover:bg-red-50">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Items ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">
                  {selectedCat ? `Items — ${selectedCat.name}` : "Select a category"}
                </h2>
                {selectedCatId && (
                  <Button size="sm" variant="outline" onClick={openNewItem} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> New Item
                  </Button>
                )}
              </div>

              {!selectedCatId && (
                <div className="p-8 text-center text-sm text-gray-400">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Select a category on the left to manage its items
                </div>
              )}

              {selectedCatId && itemsLoading && <div className="p-4 text-sm text-gray-400">Loading...</div>}

              {selectedCatId && !itemsLoading && items.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">
                  <Image className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No items in this category yet
                </div>
              )}

              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    {item.coverImage ? (
                      <img src={item.coverImage} alt={item.title} className="w-14 h-10 object-cover rounded border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center shrink-0">
                        <Image className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                      {item.titleAr && <div className="text-xs text-gray-400 truncate" dir="rtl">{item.titleAr}</div>}
                    </div>
                    <Badge variant={item.isVisible ? "default" : "secondary"} className="text-xs shrink-0">
                      {item.isVisible ? "Visible" : "Hidden"}
                    </Badge>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditItem(item as PortfolioItem)} className="p-1.5 rounded hover:bg-gray-100">
                        <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => setDeleteItemId(item.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Dialog ───────────────────────────────────────────────── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCatId ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name (English)</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. 3D Design" />
            </div>
            <div className="space-y-1.5">
              <Label>Name (Arabic)</Label>
              <Input value={catForm.nameAr} onChange={(e) => setCatForm({ ...catForm, nameAr: e.target.value })} placeholder="الاسم بالعربية" dir="rtl" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={catForm.type} onValueChange={(v) => setCatForm({ ...catForm, type: v as "portfolio" | "events" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portfolio">Portfolio (shown on /cp/)</SelectItem>
                  <SelectItem value="events">Events (shown on /events/)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" value={catForm.sortOrder} onChange={(e) => setCatForm({ ...catForm, sortOrder: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.isVisible} onCheckedChange={(v) => setCatForm({ ...catForm, isVisible: v })} />
              <Label>Visible</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={createCat.isPending || updateCat.isPending}>
              {editingCatId ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItemId ? "Edit Portfolio Item" : "New Portfolio Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title (English)</Label>
                <Input value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} placeholder="Project title" />
              </div>
              <div className="space-y-1.5">
                <Label>Title (Arabic)</Label>
                <Input value={itemForm.titleAr} onChange={(e) => setItemForm({ ...itemForm, titleAr: e.target.value })} placeholder="العنوان بالعربية" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Description (English)</Label>
                <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Project description..." rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (Arabic)</Label>
                <Textarea value={itemForm.descriptionAr} onChange={(e) => setItemForm({ ...itemForm, descriptionAr: e.target.value })} placeholder="وصف المشروع..." rows={4} dir="rtl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cover Image</Label>
              <NativeMediaField
                value={itemForm.coverImage}
                onChange={(url) => setItemForm({ ...itemForm, coverImage: url })}
                placeholder="Cover image URL"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Video URL (YouTube or direct link — optional)</Label>
              <Input value={itemForm.videoUrl} onChange={(e) => setItemForm({ ...itemForm, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input type="number" value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={itemForm.isVisible} onCheckedChange={(v) => setItemForm({ ...itemForm, isVisible: v })} />
                <Label>Visible</Label>
              </div>
            </div>

            {/* Gallery images — only for existing items */}
            {editingItemId && (
              <div className="space-y-2">
                <Label>Gallery Images</Label>
                <div className="grid grid-cols-3 gap-2">
                  {editingImages.map((img) => (
                    <div key={img.id} className="relative group rounded overflow-hidden border border-gray-200 aspect-video">
                      <img src={img.url} alt={img.altText ?? ""} className="w-full h-full object-cover" />
                      <button
                        onClick={() => deleteImage.mutate({ id: img.id })}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <NativeMediaField
                    value={newImageUrl}
                    onChange={setNewImageUrl}
                    placeholder="Add gallery image URL"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (newImageUrl.trim()) addImage.mutate({ itemId: editingItemId, url: newImageUrl.trim(), sortOrder: editingImages.length }); }}
                    disabled={!newImageUrl.trim() || addImage.isPending}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* For new items, show inline image adder */}
            {!editingItemId && (
              <div className="space-y-2">
                <Label>Gallery Images (add after saving, or add now)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {itemImages.map((img, i) => (
                    <div key={i} className="relative group rounded overflow-hidden border border-gray-200 aspect-video">
                      <img src={img.url} alt={img.altText} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setItemImages(itemImages.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <NativeMediaField
                    value={newImageUrl}
                    onChange={setNewImageUrl}
                    placeholder="Add gallery image URL"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (newImageUrl.trim()) { setItemImages([...itemImages, { url: newImageUrl.trim(), altText: "", sortOrder: itemImages.length }]); setNewImageUrl(""); } }}
                    disabled={!newImageUrl.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button onClick={saveItem} disabled={createItem.isPending || updateItem.isPending}>
              {editingItemId ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Confirm ───────────────────────────────────────── */}
      <AlertDialog open={deleteCatId !== null} onOpenChange={(open) => !open && setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the category and all its portfolio items and images.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCatId && deleteCat.mutate({ id: deleteCatId })} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Item Confirm ───────────────────────────────────────────── */}
      <AlertDialog open={deleteItemId !== null} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio Item?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the item and all its gallery images.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemId && deleteItem.mutate({ id: deleteItemId })} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
