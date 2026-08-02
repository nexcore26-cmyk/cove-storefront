import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Pencil,
  Trash2,
  Navigation,
  ExternalLink,
  Save,
  GripVertical,
  EyeOff,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

type MenuLocation = 'header' | 'footer' | 'mobile' | 'custom';

type MenuItem = {
  id: number;
  menuId: number;
  parentId: number | null;
  label: string;
  labelAr?: string | null;
  href: string;
  target: 'self' | 'blank';
  sortOrder: number;
  isVisible: boolean;
  icon?: string | null;
};

type FlatMenuItem = MenuItem & {
  depth: number;
  children: MenuItem[];
};

type MenuItemForm = {
  id?: number;
  menuId: number;
  parentId: number | null;
  label: string;
  labelAr: string;
  href: string;
  target: 'self' | 'blank';
  sortOrder: number;
  isVisible: boolean;
  icon: string;
};

type MenuForm = {
  key: string;
  name: string;
  location: MenuLocation;
  isActive: boolean;
};

const emptyItem = (menuId = 0): MenuItemForm => ({
  menuId,
  parentId: null,
  label: '',
  labelAr: '',
  href: '/',
  target: 'self',
  sortOrder: 0,
  isVisible: true,
  icon: '',
});

const emptyMenu: MenuForm = {
  key: '',
  name: '',
  location: 'custom',
  isActive: true,
};

function normalizeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('#')) return trimmed;
  return `/${trimmed}`;
}

function normalizeMenuKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

function flattenMenuItems(items: MenuItem[]): FlatMenuItem[] {
  const byParent = new Map<number | null, MenuItem[]>();
  items.forEach((item) => {
    const key = item.parentId ?? null;
    const siblings = byParent.get(key) || [];
    siblings.push(item);
    byParent.set(key, siblings);
  });
  byParent.forEach((siblings) => siblings.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id));

  const output: FlatMenuItem[] = [];
  const walk = (parentId: number | null, depth: number) => {
    const siblings = byParent.get(parentId) || [];
    siblings.forEach((item) => {
      const children = byParent.get(item.id) || [];
      output.push({ ...item, depth, children });
      walk(item.id, depth + 1);
    });
  };
  walk(null, 0);
  return output;
}

function collectDescendantIds(items: MenuItem[], itemId: number) {
  const ids = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((item) => {
      if (item.parentId && (item.parentId === itemId || ids.has(item.parentId)) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    });
  }
  return ids;
}

function buildReorderPayload(items: MenuItem[]) {
  const grouped = new Map<number | null, MenuItem[]>();
  items.forEach((item) => {
    const parentId = item.parentId ?? null;
    const siblings = grouped.get(parentId) || [];
    siblings.push(item);
    grouped.set(parentId, siblings);
  });

  const payload: Array<{ id: number; parentId: number | null; sortOrder: number }> = [];
  grouped.forEach((siblings, parentId) => {
    siblings.forEach((item, index) => {
      payload.push({ id: item.id, parentId, sortOrder: index * 10 });
    });
  });
  return payload;
}

function SortableMenuRow({ item, onEdit, onDelete }: { item: FlatMenuItem; onEdit: (item: MenuItem) => void; onDelete: (item: MenuItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 border-b bg-card ${isDragging ? 'relative z-10 shadow-lg ring-2 ring-[#9D7D39]/30' : ''}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" style={{ paddingLeft: `${item.depth * 28}px` }}>
        <div className="min-w-0 flex items-start gap-3">
          <button
            type="button"
            className="mt-1 rounded border p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label={`Drag ${item.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.label}</span>
              {item.labelAr && <span className="text-sm text-muted-foreground" dir="rtl">{item.labelAr}</span>}
              {item.depth > 0 && <Badge variant="outline">Level {item.depth + 1}</Badge>}
              {item.children.length > 0 && <Badge variant="secondary">{item.children.length} child links</Badge>}
              {!item.isVisible && <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Hidden</Badge>}
              {item.target === 'blank' && <Badge variant="outline">New tab</Badge>}
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
              <ExternalLink className="h-3 w-3" />
              <span>{item.href}</span>
              <span>•</span>
              <span>Order {item.sortOrder}</span>
              {item.icon && <><span>•</span><span>Icon {item.icon}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:shrink-0">
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMenuBuilder() {
  const utils = trpc.useUtils();
  const [selectedKey, setSelectedKey] = useState('header');
  const { data: menus = [] } = trpc.menuBuilder.listMenus.useQuery();
  const { data: menu, isLoading } = trpc.menuBuilder.getMenu.useQuery({ key: selectedKey });
  const [menuName, setMenuName] = useState('Header Navigation');
  const [menuLocation, setMenuLocation] = useState<MenuLocation>('header');
  const [isActive, setIsActive] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [form, setForm] = useState<MenuItemForm>(emptyItem());
  const [menuForm, setMenuForm] = useState<MenuForm>(emptyMenu);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (menu) {
      setMenuName(menu.name || 'Navigation Menu');
      setMenuLocation((menu.location || 'custom') as MenuLocation);
      setIsActive(menu.isActive ?? true);
    }
  }, [menu]);

  const items = useMemo(() => [...((menu?.items || []) as MenuItem[])], [menu?.items]);
  const flatItems = useMemo(() => flattenMenuItems(items), [items]);
  const sortableIds = flatItems.map((item) => item.id);

  const invalidate = () => {
    utils.menuBuilder.listMenus.invalidate();
    utils.menuBuilder.getMenu.invalidate({ key: selectedKey });
    utils.menuBuilder.getPublicMenu.invalidate();
  };

  const seedDefaults = trpc.menuBuilder.seedDefaults.useMutation({
    onSuccess: () => { toast.success('Default header and footer menus are ready'); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to prepare default menus'),
  });

  const createMenu = trpc.menuBuilder.createMenu.useMutation({
    onSuccess: () => {
      toast.success('Menu created');
      setSelectedKey(menuForm.key);
      setMenuDialogOpen(false);
      setMenuForm(emptyMenu);
      invalidate();
    },
    onError: (error) => toast.error(error.message || 'Failed to create menu'),
  });

  const updateMenu = trpc.menuBuilder.updateMenu.useMutation({
    onSuccess: () => { toast.success('Menu settings saved'); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to save menu settings'),
  });

  const createItem = trpc.menuBuilder.createItem.useMutation({
    onSuccess: () => { toast.success('Menu item added'); setDialogOpen(false); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to add menu item'),
  });

  const updateItem = trpc.menuBuilder.updateItem.useMutation({
    onSuccess: () => { toast.success('Menu item updated'); setDialogOpen(false); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to update menu item'),
  });

  const reorderItems = trpc.menuBuilder.reorderItems.useMutation({
    onSuccess: () => { toast.success('Menu order saved'); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to save menu order'),
  });

  const deleteItem = trpc.menuBuilder.deleteItem.useMutation({
    onSuccess: (result) => { toast.success(`Menu item removed${result?.deletedCount ? ` with ${result.deletedCount - 1} child links` : ''}`); invalidate(); },
    onError: (error) => toast.error(error.message || 'Failed to remove menu item'),
  });

  const openNew = () => {
    if (!menu?.id) return;
    const nextSort = items.length ? Math.max(...items.map((i) => i.sortOrder || 0)) + 10 : 10;
    setForm({ ...emptyItem(menu.id), sortOrder: nextSort });
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setForm({
      id: item.id,
      menuId: item.menuId,
      parentId: item.parentId ?? null,
      label: item.label || '',
      labelAr: item.labelAr || '',
      href: item.href || '/',
      target: item.target || 'self',
      sortOrder: item.sortOrder ?? 0,
      isVisible: item.isVisible ?? true,
      icon: item.icon || '',
    });
    setDialogOpen(true);
  };

  const saveItem = () => {
    const payload = {
      ...form,
      href: normalizeHref(form.href),
      label: form.label.trim(),
      labelAr: form.labelAr.trim() || null,
      parentId: form.parentId || null,
      icon: form.icon.trim() || null,
    } as any;
    if (!payload.label) { toast.error('English label is required'); return; }
    if (form.id) updateItem.mutate({ ...payload, id: form.id });
    else createItem.mutate(payload);
  };

  const saveMenu = () => {
    const key = normalizeMenuKey(menuForm.key);
    if (!key || !menuForm.name.trim()) {
      toast.error('Menu key and name are required');
      return;
    }
    createMenu.mutate({ ...menuForm, key, name: menuForm.name.trim() });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!menu?.id || !over || active.id === over.id) return;
    const oldIndex = flatItems.findIndex((item) => item.id === active.id);
    const newIndex = flatItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const movedFlat = arrayMove(flatItems, oldIndex, newIndex);
    reorderItems.mutate({ menuId: menu.id, items: buildReorderPayload(movedFlat) });
  };

  const availableParents = useMemo(() => {
    const blocked = form.id ? collectDescendantIds(items, form.id) : new Set<number>();
    return flatItems.filter((item) => item.id !== form.id && !blocked.has(item.id));
  }, [flatItems, form.id, items]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-[#9D7D39]">Standalone Website Builder</p>
            <h1 className="text-3xl font-light mt-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Menu Builder</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl">Build tenant-owned header, footer, mobile, or custom menus inside Cove. Drag/drop is powered by open-source interaction code, while the saved menu structure, permissions, and public rendering remain part of Cove.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}><RefreshCw className="h-4 w-4 mr-2" />Prepare Defaults</Button>
            <Button variant="outline" onClick={() => setMenuDialogOpen(true)}><Layers className="h-4 w-4 mr-2" />New Menu</Button>
            <Button onClick={openNew} disabled={!menu?.id}><Plus className="h-4 w-4 mr-2" />Add Link</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-[#9D7D39]" />
              <h2 className="font-semibold">Menu Settings</h2>
            </div>
            <div className="space-y-2">
              <Label>Manage menu</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger><SelectValue placeholder="Select menu" /></SelectTrigger>
                <SelectContent>
                  {menus.map((availableMenu: any) => (
                    <SelectItem key={availableMenu.key} value={availableMenu.key}>{availableMenu.name} · {availableMenu.key}</SelectItem>
                  ))}
                  {menus.length === 0 && <SelectItem value="header">Header Navigation</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Menu name</Label>
              <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Menu location</Label>
              <Select value={menuLocation} onValueChange={(value: MenuLocation) => setMenuLocation(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="footer">Footer</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active on storefront</Label>
                <p className="text-xs text-muted-foreground">Disable to force the public fallback links.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="w-full" onClick={() => menu?.id && updateMenu.mutate({ id: menu.id, name: menuName, location: menuLocation, isActive })} disabled={!menu?.id || updateMenu.isPending}>
              <Save className="h-4 w-4 mr-2" />Save Settings
            </Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Standalone rule:</strong> menus are saved inside Cove. No external website-builder subscription controls this data.
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-5 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">{menu?.name || 'Navigation'} Links</h2>
                <p className="text-xs text-muted-foreground mt-1">Drag links to reorder. Use the parent selector while editing a link to create dropdown or footer groups.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{flatItems.length} links</Badge>
                {reorderItems.isPending && <Badge variant="outline">Saving order...</Badge>}
              </div>
            </div>
            {isLoading ? (
              <div className="p-8 text-sm text-muted-foreground">Loading menu...</div>
            ) : !menu ? (
              <div className="p-8 text-sm text-muted-foreground">No menu exists yet. Prepare defaults or create a new menu.</div>
            ) : flatItems.length === 0 ? (
              <div className="p-8 text-sm text-muted-foreground">No menu links yet. Add the first link to replace the default storefront fallback.</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div>
                    {flatItems.map((item) => (
                      <SortableMenuRow
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={(target) => { if (confirm(`Delete ${target.label}? Child links will also be removed.`)) deleteItem.mutate({ id: target.id }); }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? 'Edit Menu Link' : 'Add Menu Link'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Label — English</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Collections" /></div>
                <div className="space-y-2"><Label>Label — Arabic</Label><Input value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} placeholder="المجموعات" dir="rtl" /></div>
              </div>
              <div className="space-y-2"><Label>Link URL</Label><Input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/pages/contact" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parent / dropdown group</Label>
                  <Select value={form.parentId ? String(form.parentId) : 'root'} onValueChange={(value) => setForm({ ...form, parentId: value === 'root' ? null : Number(value) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Top-level link</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={String(parent.id)}>{'— '.repeat(parent.depth)}{parent.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Target</Label><Select value={form.target} onValueChange={(value: 'self' | 'blank') => setForm({ ...form, target: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="self">Same tab</SelectItem><SelectItem value="blank">New tab</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Sort order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Icon key / CSS class</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="optional" /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>Visible</Label><p className="text-xs text-muted-foreground">Hidden links stay saved but do not appear publicly.</p></div><Switch checked={form.isVisible} onCheckedChange={(value) => setForm({ ...form, isVisible: value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveItem} disabled={createItem.isPending || updateItem.isPending}>Save Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create Menu</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2"><Label>Menu key</Label><Input value={menuForm.key} onChange={(e) => setMenuForm({ ...menuForm, key: normalizeMenuKey(e.target.value) })} placeholder="footer-secondary" /></div>
              <div className="space-y-2"><Label>Menu name</Label><Input value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Footer Secondary" /></div>
              <div className="space-y-2"><Label>Location</Label><Select value={menuForm.location} onValueChange={(value: MenuLocation) => setMenuForm({ ...menuForm, location: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="header">Header</SelectItem><SelectItem value="footer">Footer</SelectItem><SelectItem value="mobile">Mobile</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>Active</Label><p className="text-xs text-muted-foreground">Inactive menus remain saved but are not rendered publicly.</p></div><Switch checked={menuForm.isActive} onCheckedChange={(value) => setMenuForm({ ...menuForm, isActive: value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMenuDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveMenu} disabled={createMenu.isPending}>Create Menu</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
