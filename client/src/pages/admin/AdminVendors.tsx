import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Archive, Building2, KeyRound } from "lucide-react";
import { toast } from 'sonner';

type Vendor = {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  commissionPercent: string | null;
  isActive: boolean;
  status?: "active" | "inactive" | "pending" | "archived";
  portalUsername?: string | null;
  createdAt: Date;
};

const emptyForm = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
  commissionPercent: 0,
  isActive: true,
  status: "active" as "active" | "inactive" | "pending" | "archived",
  portalUsername: "",
  portalPassword: "",
};

export default function AdminVendors() {
  const utils = trpc.useUtils();

  const { data: vendors = [], isLoading } = trpc.vendors.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: () => {
      utils.vendors.list.invalidate();
      setDialogOpen(false);
      toast.success('Vendor created');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.vendors.update.useMutation({
    onSuccess: () => {
      utils.vendors.list.invalidate();
      setDialogOpen(false);
      toast.success('Vendor updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.vendors.delete.useMutation({
    onSuccess: () => {
      utils.vendors.list.invalidate();
      setDeleteId(null);
      toast.success('Vendor archived');
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingVendor(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditingVendor(v);
    setForm({
      name: v.name,
      contactName: v.contactName ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      notes: v.notes ?? "",
      commissionPercent: parseFloat(v.commissionPercent ?? "0"),
      isActive: v.isActive,
      status: v.status ?? (v.isActive ? "active" : "inactive"),
      portalUsername: v.portalUsername ?? "",
      portalPassword: "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      commissionPercent: form.commissionPercent,
      isActive: form.status === "active",
      status: form.status,
      portalUsername: form.portalUsername.trim() || undefined,
      portalPassword: form.portalPassword.trim() || undefined,
    };
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold text-white">Vendors</h1>
              <p className="text-sm text-zinc-400">Manage suppliers and consignment partners</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Name</TableHead>
                <TableHead className="text-zinc-400">Contact</TableHead>
                <TableHead className="text-zinc-400">Email / Phone</TableHead>
                <TableHead className="text-zinc-400 text-right">Commission %</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Portal</TableHead>
                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                    Loading vendors...
                  </TableCell>
                </TableRow>
              ) : vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                    No vendors yet. Click "Add Vendor" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((v) => (
                  <TableRow key={v.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-white">{v.name}</TableCell>
                    <TableCell className="text-zinc-300">{v.contactName ?? "—"}</TableCell>
                    <TableCell className="text-zinc-300 text-sm">
                      <div>{v.email ?? "—"}</div>
                      <div className="text-zinc-500">{v.phone ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-right text-zinc-300">
                      {parseFloat(v.commissionPercent ?? "0").toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={(v.status ?? (v.isActive ? "active" : "inactive")) === "active" ? "default" : "secondary"}
                        className={(v.status ?? (v.isActive ? "active" : "inactive")) === "active" ? "bg-emerald-900 text-emerald-300" : "bg-zinc-700 text-zinc-400"}
                      >
                        {v.status ?? (v.isActive ? "active" : "inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm">
                      {v.portalUsername ? <span className="inline-flex items-center gap-1"><KeyRound className="w-3 h-3" />{v.portalUsername}</span> : "Not configured"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-white"
                          onClick={() => openEdit(v as Vendor)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-red-400"
                          onClick={() => setDeleteId(v.id)}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "New Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-zinc-300">Vendor Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Al-Hamra Furniture Co."
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-300">Contact Name</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="Ahmed Al-Rashid"
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+965 9999 9999"
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-zinc-300">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vendor@example.com"
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Commission % (default for products)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: parseFloat(e.target.value) || 0 })}
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Payment terms, delivery schedule, etc."
                className="bg-zinc-800 border-zinc-700 text-white mt-1 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-300">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white mt-1 rounded-md px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <Label className="text-zinc-300">Portal Username</Label>
                <Input
                  value={form.portalUsername}
                  onChange={(e) => setForm({ ...form, portalUsername: e.target.value })}
                  placeholder="vendor-login"
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-zinc-300">Portal Password {editingVendor ? "(leave blank to keep current)" : ""}</Label>
              <Input
                type="password"
                value={form.portalPassword}
                onChange={(e) => setForm({ ...form, portalPassword: e.target.value })}
                placeholder="Minimum 8 characters"
                className="bg-zinc-800 border-zinc-700 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !form.name.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSaving ? "Saving..." : editingVendor ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete the vendor. Products linked to this vendor will lose their vendor association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800 text-white"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
