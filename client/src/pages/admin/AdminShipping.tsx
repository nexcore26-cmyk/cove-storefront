import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Package, MapPin, AlertCircle } from "lucide-react";

// ─── Shipping Classes Tab ────────────────────────────────────────────────────

function ShippingClassesTab() {
  const utils = trpc.useUtils();
  const { data: classes = [], isLoading } = trpc.shipping.listShippingClasses.useQuery();
  const { data: zones = [] } = trpc.shipping.zones.useQuery();
  const activeZones = (zones as any[]).filter((z: any) => z.isActive !== false);

  type ZoneRateMode = "flat" | "per_quantity";
  type ZoneRateForm = { zoneId: number; zoneName: string; mode: ZoneRateMode; cost: string; isFree?: boolean };
  type ShippingClassDialog = {
    id?: number;
    name: string;
    slug: string;
    description: string;
    kuwaitCost: string;
    gccCostPerUnit: string;
    kuwaitOnly: boolean;
    isActive: boolean;
    isFree: boolean;
    zoneRates: Record<string, ZoneRateForm>;
  };

  const normalizeCost = (value: any, fallback = "0.000") => {
    const n = parseFloat(String(value ?? fallback));
    return Number.isFinite(n) ? n.toFixed(3) : fallback;
  };

  const zoneIncludesKuwait = (zone: any) => Array.isArray(zone.countries) && zone.countries.includes("KW");

  const buildZoneRates = (c?: any): Record<string, ZoneRateForm> => {
    const existing = Array.isArray(c?.zoneRates) ? c.zoneRates : [];
    const existingByZoneId = new Map(existing.map((r: any) => [String(r.zoneId), r]));

    return Object.fromEntries(activeZones.map((zone: any) => {
      const key = String(zone.id);
      const prior = existingByZoneId.get(key) as any;
      const fallbackCost = zoneIncludesKuwait(zone)
        ? normalizeCost(c?.kuwaitCost ?? "2.000")
        : normalizeCost(c?.gccCostPerUnit ?? "0.000");
      const fallbackMode: ZoneRateMode = zoneIncludesKuwait(zone) ? "flat" : "per_quantity";
      const mode: ZoneRateMode = prior?.mode === "flat" || prior?.mode === "per_quantity" ? prior.mode : fallbackMode;
      const cost = normalizeCost(prior?.cost ?? fallbackCost);
      const isFree = prior?.isFree === true ? true : false;
      return [key, { zoneId: zone.id, zoneName: zone.name, mode, cost, isFree }];
    }));
  };

  const upsert = trpc.shipping.upsertShippingClass.useMutation({
    onSuccess: () => { utils.shipping.listShippingClasses.invalidate(); toast.success("Saved"); setDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.shipping.deleteShippingClass.useMutation({
    onSuccess: () => { utils.shipping.listShippingClasses.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState<null | ShippingClassDialog>(null);

  const openNew = () => setDialog({
    name: "",
    slug: "",
    description: "",
    kuwaitCost: "2.000",
    gccCostPerUnit: "0.000",
    kuwaitOnly: false,
    isActive: true,
    isFree: false,
    zoneRates: buildZoneRates({ kuwaitCost: "2.000", gccCostPerUnit: "0.000" }),
  });

  const openEdit = (c: any) => setDialog({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    kuwaitCost: normalizeCost(c.kuwaitCost),
    gccCostPerUnit: normalizeCost(c.gccCostPerUnit),
    kuwaitOnly: !!c.kuwaitOnly,
    isActive: !!c.isActive,
    isFree: !!c.isFree,
    zoneRates: buildZoneRates(c),
  });

  const updateZoneRate = (zoneId: number, patch: Partial<ZoneRateForm>) => {
    if (!dialog) return;
    const key = String(zoneId);
    const current = dialog.zoneRates[key];
    if (!current) return;
    setDialog({
      ...dialog,
      zoneRates: {
        ...dialog.zoneRates,
        [key]: { ...current, ...patch },
      },
    });
  };

  const handleSave = () => {
    if (!dialog) return;
    const zoneRates = Object.values(dialog.zoneRates).map(rate => ({
      zoneId: rate.zoneId,
      zoneName: rate.zoneName,
      mode: rate.mode,
      cost: (dialog.isFree || rate.isFree) ? 0 : (parseFloat(rate.cost) || 0),
      isFree: dialog.isFree || !!rate.isFree,
    }));
    const kuwaitRate = zoneRates.find(rate => activeZones.some((zone: any) => zone.id === rate.zoneId && zoneIncludesKuwait(zone)));
    const gccRate = zoneRates.find(rate => activeZones.some((zone: any) => zone.id === rate.zoneId && !zoneIncludesKuwait(zone)));

    upsert.mutate({
      id: dialog.id,
      name: dialog.name,
      slug: dialog.slug || dialog.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: dialog.description || undefined,
      kuwaitCost: kuwaitRate ? kuwaitRate.cost : (parseFloat(dialog.kuwaitCost) || 0),
      gccCostPerUnit: gccRate ? gccRate.cost : (parseFloat(dialog.gccCostPerUnit) || 0),
      kuwaitOnly: dialog.kuwaitOnly,
      isActive: dialog.isActive,
      isFree: dialog.isFree,
      zoneRates,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Shipping Classes</h2>
          <p className="text-sm text-muted-foreground">Define each class cost per active shipping zone, either flat or per quantity.</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Class</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Zone Pricing</TableHead>
            <TableHead>Kuwait Only</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
          )}
          {!isLoading && classes.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No shipping classes yet.</TableCell></TableRow>
          )}
          {classes.map((c: any) => {
            const configuredRates = Array.isArray(c.zoneRates) ? c.zoneRates : [];
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{c.slug}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.isFree ? <span className="text-green-600 font-medium text-xs">Free</span> : `Legacy: KW ${normalizeCost(c.kuwaitCost)} · GCC ${normalizeCost(c.gccCostPerUnit)} × qty`}
                </TableCell>
                <TableCell>
                  {c.kuwaitOnly ? <Badge variant="secondary" className="text-xs">KW Only</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate({ id: c.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit Shipping Class" : "New Shipping Class"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={dialog.name} onChange={e => setDialog({ ...dialog, name: e.target.value })} placeholder="R1 Shipping GCC" />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input value={dialog.slug} onChange={e => setDialog({ ...dialog, slug: e.target.value })} placeholder="r1-shipping-gcc" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input value={dialog.description} onChange={e => setDialog({ ...dialog, description: e.target.value })} placeholder="For R1 category items" />
              </div>

              <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                <div>
                  <p className="text-sm font-medium">Active Zone Pricing</p>
                  <p className="text-xs text-muted-foreground">Each active shipping zone gets its own cost. Flat charges once; per quantity multiplies by the item quantity.</p>
                </div>
                {activeZones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active shipping zones. Add or activate zones first.</p>
                ) : activeZones.map((zone: any) => {
                  const rate = dialog.zoneRates[String(zone.id)] ?? {
                    zoneId: zone.id,
                    zoneName: zone.name,
                    mode: zoneIncludesKuwait(zone) ? "flat" : "per_quantity",
                    cost: "0.000",
                  };
                  const zoneIsFree = dialog.isFree || !!rate.isFree;
                  return (
                    <div key={zone.id} className="rounded-md border bg-background p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{zone.name}</p>
                          <p className="text-xs text-muted-foreground">{Array.isArray(zone.countries) && zone.countries.length ? zone.countries.join(", ") : "Catch-all zone"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Free</span>
                          <Switch
                            checked={zoneIsFree}
                            disabled={dialog.isFree}
                            onCheckedChange={v => updateZoneRate(zone.id, { isFree: v, cost: v ? "0.000" : rate.cost })}
                          />
                        </div>
                      </div>
                      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-end ${zoneIsFree ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className="space-y-1.5 md:col-span-1">
                          <Label>Pricing Mode</Label>
                          <div className="grid grid-cols-2 gap-1 rounded-md border p-1">
                            <Button type="button" size="sm" variant={rate.mode === "flat" ? "default" : "ghost"} onClick={() => updateZoneRate(zone.id, { mode: "flat" })}>Flat</Button>
                            <Button type="button" size="sm" variant={rate.mode === "per_quantity" ? "default" : "ghost"} onClick={() => updateZoneRate(zone.id, { mode: "per_quantity" })}>Per qty</Button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cost (KWD)</Label>
                          <Input type="number" step="0.001" min="0" value={zoneIsFree ? "0.000" : rate.cost} onChange={e => updateZoneRate(zone.id, { cost: e.target.value })} disabled={zoneIsFree} />
                        </div>
                        <div className="text-xs text-muted-foreground pb-2">
                          {zoneIsFree
                            ? <span className="text-green-600 font-medium">Free for {zone.name}</span>
                            : rate.mode === "flat"
                              ? `${normalizeCost(rate.cost)} KWD once for this class in ${zone.name}`
                              : `${normalizeCost(rate.cost)} KWD × item quantity for ${zone.name}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Free Shipping</p>
                  <p className="text-xs text-muted-foreground">No shipping cost — displayed as "Free" on storefront checkout</p>
                </div>
                <Switch checked={dialog.isFree} onCheckedChange={v => setDialog({ ...dialog, isFree: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Kuwait Only</p>
                  <p className="text-xs text-muted-foreground">Products with this class cannot be shipped outside Kuwait</p>
                </div>
                <Switch checked={dialog.kuwaitOnly} onCheckedChange={v => setDialog({ ...dialog, kuwaitOnly: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Inactive classes won't be used in shipping calculations</p>
                </div>
                <Switch checked={dialog.isActive} onCheckedChange={v => setDialog({ ...dialog, isActive: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── Kuwait Cities Tab ───────────────────────────────────────────────────────

function KuwaitCitiesTab() {
  const utils = trpc.useUtils();
  const { data: cities = [], isLoading } = trpc.shipping.listAllKuwaitCities.useQuery();
  const upsert = trpc.shipping.upsertKuwaitCity.useMutation({
    onSuccess: () => { utils.shipping.listAllKuwaitCities.invalidate(); utils.shipping.listKuwaitCities.invalidate(); toast.success("Saved"); setDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.shipping.deleteKuwaitCity.useMutation({
    onSuccess: () => { utils.shipping.listAllKuwaitCities.invalidate(); utils.shipping.listKuwaitCities.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState<null | { id?: number; cityName: string; cityNameAr: string; surcharge: string; isActive: boolean; sortOrder: string }>(null);
  const [search, setSearch] = useState("");

  const filtered = cities.filter((c: any) => c.cityName.toLowerCase().includes(search.toLowerCase()) || (c.cityNameAr || "").includes(search));

  const openNew = () => setDialog({ cityName: "", cityNameAr: "", surcharge: "0.000", isActive: true, sortOrder: "0" });
  const openEdit = (c: any) => setDialog({ id: c.id, cityName: c.cityName, cityNameAr: c.cityNameAr ?? "", surcharge: String(parseFloat(c.surcharge).toFixed(3)), isActive: !!c.isActive, sortOrder: String(c.sortOrder ?? 0) });

  const handleSave = () => {
    if (!dialog) return;
    upsert.mutate({
      id: dialog.id,
      cityName: dialog.cityName,
      cityNameAr: dialog.cityNameAr || undefined,
      surcharge: parseFloat(dialog.surcharge) || 0,
      isActive: dialog.isActive,
      sortOrder: parseInt(dialog.sortOrder) || 0,
    });
  };

  const surchargeCount = cities.filter((c: any) => parseFloat(c.surcharge) > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kuwait Cities</h2>
          <p className="text-sm text-muted-foreground">
            {cities.length} cities · {surchargeCount} with extra surcharge · Base Kuwait delivery: 2.000 KWD
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search cities..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
          <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add City</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City (EN)</TableHead>
              <TableHead>City (AR)</TableHead>
              <TableHead className="text-right">Surcharge (KWD)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No cities found.</TableCell></TableRow>
            )}
            {filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.cityName}</TableCell>
                <TableCell className="text-muted-foreground">{c.cityNameAr || "—"}</TableCell>
                <TableCell className="text-right">
                  {parseFloat(c.surcharge) > 0
                    ? <span className="font-medium text-amber-600">+{parseFloat(c.surcharge).toFixed(3)}</span>
                    : <span className="text-muted-foreground">0.000</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? "default" : "outline"} className="text-xs">{c.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate({ id: c.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit City" : "New City"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>City Name (EN)</Label>
                  <Input value={dialog.cityName} onChange={e => setDialog({ ...dialog, cityName: e.target.value })} placeholder="Kuwait City" />
                </div>
                <div className="space-y-1.5">
                  <Label>City Name (AR)</Label>
                  <Input value={dialog.cityNameAr} onChange={e => setDialog({ ...dialog, cityNameAr: e.target.value })} placeholder="مدينة الكويت" dir="rtl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Surcharge (KWD) — added on top of 2 KWD base</Label>
                <Input type="number" step="0.001" min="0" value={dialog.surcharge} onChange={e => setDialog({ ...dialog, surcharge: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Active</p>
                <Switch checked={dialog.isActive} onCheckedChange={v => setDialog({ ...dialog, isActive: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shipping Zones Tab ──────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
];

const getCountryLabel = (code: string) => {
  const normalized = String(code || "").toUpperCase();
  return COUNTRY_OPTIONS.find(c => c.code === normalized)?.name ?? normalized;
};

function ShippingZonesTab() {
  const utils = trpc.useUtils();
  const { data: zones = [], isLoading } = trpc.shipping.zones.useQuery();
  const upsert = trpc.shipping.upsertShippingZone.useMutation({
    onSuccess: () => {
      utils.shipping.zones.invalidate();
      utils.shipping.listActiveZoneCountries.invalidate();
      toast.success("Saved");
      setDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.shipping.deleteShippingZone.useMutation({
    onSuccess: () => {
      utils.shipping.zones.invalidate();
      utils.shipping.listActiveZoneCountries.invalidate();
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState<null | { id?: number; name: string; baseCost: string; countries: string[]; customCountry: string; isActive: boolean }>(null);

  const normalizeCountries = (countries: string[]) => Array.from(new Set(
    countries.map(c => c.trim().toUpperCase()).filter(c => /^[A-Z]{2}$/.test(c))
  )).sort((a, b) => {
    if (a === "KW") return -1;
    if (b === "KW") return 1;
    return a.localeCompare(b);
  });

  const openNew = () => setDialog({ name: "", baseCost: "0.000", countries: ["KW"], customCountry: "", isActive: true });
  const openEdit = (zone: any) => setDialog({
    id: zone.id,
    name: zone.name ?? "",
    baseCost: parseFloat(String(zone.baseCost ?? "0")).toFixed(3),
    countries: normalizeCountries(Array.isArray(zone.countries) ? zone.countries : []),
    customCountry: "",
    isActive: !!zone.isActive,
  });

  const toggleCountry = (code: string, checked: boolean) => {
    if (!dialog) return;
    setDialog({
      ...dialog,
      countries: checked
        ? normalizeCountries([...dialog.countries, code])
        : dialog.countries.filter(c => c !== code),
    });
  };

  const addCustomCountry = () => {
    if (!dialog) return;
    const code = dialog.customCountry.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      toast.error("Enter a valid 2-letter ISO country code, such as JO or LB.");
      return;
    }
    setDialog({ ...dialog, countries: normalizeCountries([...dialog.countries, code]), customCountry: "" });
  };

  const handleSave = () => {
    if (!dialog) return;
    if (!dialog.name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    upsert.mutate({
      id: dialog.id,
      name: dialog.name.trim(),
      baseCost: parseFloat(dialog.baseCost) || 0,
      countries: normalizeCountries(dialog.countries),
      isActive: dialog.isActive,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Shipping Zones</h2>
          <p className="text-sm text-muted-foreground">Active zone countries control the storefront checkout country dropdown.</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Zone</Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Keep Kuwait in an active zone to preserve the existing Kuwait checkout flow, city selection, and delivery pricing.
        </p>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Base Rate</TableHead>
              <TableHead>Countries</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!isLoading && zones.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No shipping zones configured.</TableCell></TableRow>
            )}
            {zones.map((zone: any) => {
              const countries = Array.isArray(zone.countries) ? zone.countries : [];
              return (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell className="text-sm font-mono">{parseFloat(String(zone.baseCost ?? 0)).toFixed(3)} KWD</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {countries.length > 0 ? countries.map((c: string) => (
                        <Badge key={c} variant="secondary" className="text-xs">{c} · {getCountryLabel(c)}</Badge>
                      )) : <span className="text-xs text-muted-foreground">Catch-all zone</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={zone.isActive ? "default" : "outline"} className="text-xs">{zone.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(zone)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate({ id: zone.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit Shipping Zone" : "New Shipping Zone"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Zone Name</Label>
                <Input value={dialog.name} onChange={e => setDialog({ ...dialog, name: e.target.value })} placeholder="Kuwait or GCC" />
              </div>
              <div className="space-y-1.5">
                <Label>Base Shipping Rate (KWD)</Label>
                <Input type="number" step="0.001" min="0" value={dialog.baseCost} onChange={e => setDialog({ ...dialog, baseCost: e.target.value })} placeholder="2.000" />
                <p className="text-xs text-muted-foreground">Flat rate charged once per order for this zone, before any class surcharges.</p>
              </div>

              <div className="space-y-2">
                <Label>Countries</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-56 overflow-y-auto">
                  {COUNTRY_OPTIONS.map(country => (
                    <label key={country.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dialog.countries.includes(country.code)}
                        onChange={e => toggleCountry(country.code, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span><span className="font-mono text-xs">{country.code}</span> {country.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={dialog.customCountry}
                    onChange={e => setDialog({ ...dialog, customCountry: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="Add ISO code, e.g. JO"
                    className="uppercase"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomCountry(); } }}
                  />
                  <Button type="button" variant="outline" onClick={addCustomCountry}>Add</Button>
                </div>
                {dialog.countries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dialog.countries.map(code => (
                      <Badge key={code} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleCountry(code, false)}>{code} ×</Badge>
                    ))}
                  </div>
                )}
                {dialog.countries.length === 0 && (
                  <p className="text-xs text-amber-600">No countries selected. This preserves the existing catch-all zone behavior, but catch-all zones do not add countries to checkout.</p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Only active zones contribute countries to checkout.</p>
                </div>
                <Switch checked={dialog.isActive} onCheckedChange={v => setDialog({ ...dialog, isActive: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminShipping() {
  return (
    <AdminLayout>
      <div className="min-h-screen p-6" style={{ backgroundColor: '#f0ede8' }}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipping</h1>
            <p className="text-muted-foreground">Manage shipping classes, Kuwait city surcharges, and shipping zones.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Tabs defaultValue="classes">
              <div className="p-4 border-b border-gray-100">
                <TabsList className="grid w-full grid-cols-3 bg-[#f0ede8] rounded-lg p-1 h-auto">
                  <TabsTrigger
                    value="classes"
                    className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
                  >
                    <Package className="w-4 h-4" /> Shipping Classes
                  </TabsTrigger>
                  <TabsTrigger
                    value="cities"
                    className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
                  >
                    <MapPin className="w-4 h-4" /> Kuwait Cities
                  </TabsTrigger>
                  <TabsTrigger
                    value="zones"
                    className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
                  >
                    Zones
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="classes" className="p-6">
                <ShippingClassesTab />
              </TabsContent>
              <TabsContent value="cities" className="p-6">
                <KuwaitCitiesTab />
              </TabsContent>
              <TabsContent value="zones" className="p-6">
                <ShippingZonesTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
