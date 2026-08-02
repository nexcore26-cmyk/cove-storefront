import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import NativeMediaField from "@/components/admin/NativeMediaField";

type Category = {
  id: number;
  name: string;
  nameAr?: string | null;
  slug: string;
  parentId?: number | null;
  description?: string | null;
  image?: string | null;
  channel?: string | null;
  displayOrder?: number | null;
  isActive: boolean;
};

const EMPTY_FORM = {
  name: "",
  nameAr: "",
  slug: "",
  parentId: "" as string | number,
  description: "",
  image: "",
  channel: "both" as string,
  displayOrder: 0,
  isActive: true,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminCategories() {
  const utils = trpc.useUtils();

  const { data: categories = [], isLoading } = trpc.categories.list.useQuery();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [slugManual, setSlugManual] = useState(false);

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Category created");
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Category updated");
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      toast.success("Category deleted");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSlugManual(false);
    setShowDialog(true);
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      nameAr: cat.nameAr ?? "",
      slug: cat.slug,
      parentId: cat.parentId ?? "",
      description: cat.description ?? "",
      image: cat.image ?? "",
      channel: cat.channel ?? "both",
      displayOrder: cat.displayOrder ?? 0,
      isActive: cat.isActive,
    });
    setSlugManual(true);
    setShowDialog(true);
  }

  function handleNameChange(val: string) {
    setForm((f) => ({
      ...f,
      name: val,
      slug: slugManual ? f.slug : slugify(val),
    }));
  }

  function handleSubmit() {
    const payload = {
      name: form.name,
      nameAr: form.nameAr || undefined,
      slug: form.slug || undefined,
      parentId: form.parentId ? Number(form.parentId) : undefined,
      description: form.description || undefined,
      image: form.image || undefined,
      channel: form.channel as any,
      displayOrder: form.displayOrder,
      isActive: form.isActive,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Build a parent-child tree for display
  const topLevel = (categories as Category[]).filter((c) => !c.parentId);
  const childrenOf = (parentId: number) =>
    (categories as Category[]).filter((c) => c.parentId === parentId);

  const channelBadge = (channel?: string | null) => {
    const map: Record<string, string> = {
      online: "bg-blue-100 text-blue-800",
      pos: "bg-purple-100 text-purple-800",
      both: "bg-green-100 text-green-800",
      none: "bg-gray-100 text-gray-500",
      web: "bg-blue-100 text-blue-800",
      store: "bg-purple-100 text-purple-800",
    };
    return map[channel ?? "both"] ?? "bg-gray-100 text-gray-500";
  };

  function renderRow(cat: Category, depth = 0) {
    const children = childrenOf(cat.id);
    return (
      <div key={cat.id}>
        <div
          className={`flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors ${depth > 0 ? "bg-muted/10" : ""}`}
        >
          <div style={{ width: depth * 20 }} />
          {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{cat.name}</span>
              {cat.nameAr && (
                <span className="text-sm text-muted-foreground" dir="rtl">
                  {cat.nameAr}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">/category/{cat.slug}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelBadge(cat.channel)}`}>
            {cat.channel ?? "both"}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${cat.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
            {cat.isActive ? "Active" : "Inactive"}
          </span>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cat)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(cat.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {children.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="min-h-screen p-6" style={{ backgroundColor: '#f0ede8' }}>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Product Categories</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage categories shown on the storefront and POS
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div className="flex-1">Category</div>
              <div className="w-20 text-center">Channel</div>
              <div className="w-16 text-center">Status</div>
              <div className="w-16 text-center">Actions</div>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : topLevel.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No categories yet. Click "Add Category" to create one.
              </div>
            ) : (
              topLevel.map((cat) => renderRow(cat as Category))
            )}
          </div>{/* end table card */}

        {/* Create / Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Category" : "New Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Name EN */}
              <div className="space-y-1.5">
                <Label>Name (English) *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Living Room"
                />
              </div>
              {/* Name AR */}
              <div className="space-y-1.5">
                <Label>Name (Arabic)</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder="e.g. غرفة المعيشة"
                  dir="rtl"
                />
              </div>
              {/* Slug */}
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  placeholder="auto-generated from name"
                />
                <p className="text-xs text-muted-foreground">
                  URL: /category/{form.slug || "…"}
                </p>
              </div>
              {/* Parent */}
              <div className="space-y-1.5">
                <Label>Parent Category</Label>
                <Select
                  value={String(form.parentId ?? "")}
                  onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {(categories as Category[])
                      .filter((c) => c.id !== editingId)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Thumbnail */}
              <NativeMediaField
                label="Category Thumbnail"
                value={form.image}
                entityType="category"
                entityId={editingId}
                helperText="Upload or select a native Cove image for this category."
                onChange={(image) => setForm((f) => ({ ...f, image }))}
              />
              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional category description"
                />
              </div>
              {/* Channel + Display Order */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Channel</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both (Online + POS)</SelectItem>
                      <SelectItem value="online">Online only</SelectItem>
                      <SelectItem value="pos">POS only</SelectItem>
                      <SelectItem value="none">None (hidden)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              {/* Active */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving || !form.name}>
                {isSaving ? "Saving…" : editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the category. Products assigned to it will not be
                deleted but will lose this category assignment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>{/* end max-w-5xl */}
      </div>{/* end bg wrapper */}
    </AdminLayout>
  );
}
