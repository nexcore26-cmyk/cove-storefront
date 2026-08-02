/**
 * P12 — Admin Customer Management Page
 * Features:
 * - Paginated list with search by name/email/phone
 * - Filter by country
 * - Sort by totalSpent / totalOrders / createdAt / name
 * - Customer detail panel: profile, order history, editable notes
 * - Recalculate totals button
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, User, ShoppingBag,
  Phone, Mail, MapPin, StickyNote, ArrowUpDown, Download,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';


const PAGE_SIZE = 50;

type SortBy = 'totalSpent' | 'totalOrders' | 'createdAt' | 'name';
type SortDir = 'asc' | 'desc';

function formatKwd(val: string | number | null | undefined) {
  const n = parseFloat(String(val ?? '0'));
  return isNaN(n) ? '0.000 KWD' : `${n.toFixed(3)} KWD`;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    processing: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-purple-100 text-purple-800',
    delivered: 'bg-teal-100 text-teal-800',
    exchanged: 'bg-orange-100 text-orange-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notesEdit, setNotesEdit] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);

  const debouncedSearch = useDebounce(search, 350);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.customers.list.useQuery({
    search: debouncedSearch || undefined,
    country: country || undefined,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset,
  });

  const { data: detail, isLoading: detailLoading } = trpc.customers.byId.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null }
  );

  const updateNotesMutation = trpc.customers.updateNotes.useMutation({
    onSuccess: () => {
      toast.success('Notes saved');
      setEditingNotes(false);
      utils.customers.byId.invalidate({ id: selectedId! });
      utils.customers.list.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const recalcMutation = trpc.customers.recalcTotals.useMutation({
    onSuccess: (res) => {
      toast.success(`Recalculated: ${res.totalOrders} orders, ${formatKwd(res.totalSpent)}`);
      utils.customers.byId.invalidate({ id: selectedId! });
      utils.customers.list.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const openCustomer = useCallback((id: number, notes: string | null) => {
    setSelectedId(id);
    setNotesEdit(notes ?? '');
    setEditingNotes(false);
  }, []);

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setOffset(0);
  };

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const [isExporting, setIsExporting] = useState(false);
  const exportCsvQuery = trpc.customers.exportCsv.useQuery(undefined, { enabled: false });

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const result = await exportCsvQuery.refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.count} customers`);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString()} customer{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          {isExporting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={e => { setSearch(e.target.value); setOffset(0); }}
                className="pl-9"
              />
            </div>
            <Select value={country || '__all__'} onValueChange={v => { setCountry(v === '__all__' ? '' : v); setOffset(0); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Countries</SelectItem>
                <SelectItem value="KW">Kuwait</SelectItem>
                <SelectItem value="SA">Saudi Arabia</SelectItem>
                <SelectItem value="AE">UAE</SelectItem>
                <SelectItem value="BH">Bahrain</SelectItem>
                <SelectItem value="QA">Qatar</SelectItem>
                <SelectItem value="OM">Oman</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortBy}:${sortDir}`} onValueChange={v => {
              const [col, dir] = v.split(':') as [SortBy, SortDir];
              setSortBy(col); setSortDir(dir); setOffset(0);
            }}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">Newest First</SelectItem>
                <SelectItem value="createdAt:asc">Oldest First</SelectItem>
                <SelectItem value="totalSpent:desc">Highest Spend</SelectItem>
                <SelectItem value="totalSpent:asc">Lowest Spend</SelectItem>
                <SelectItem value="totalOrders:desc">Most Orders</SelectItem>
                <SelectItem value="totalOrders:asc">Fewest Orders</SelectItem>
                <SelectItem value="name:asc">Name A–Z</SelectItem>
                <SelectItem value="name:desc">Name Z–A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Country</th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('totalOrders')}
                  >
                    Orders {sortBy === 'totalOrders' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('totalSpent')}
                  >
                    Total Spent {sortBy === 'totalSpent' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort('createdAt')}
                  >
                    Joined {sortBy === 'createdAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No customers found
                    </td>
                  </tr>
                ) : rows.map((c: NonNullable<typeof data>['rows'][number]) => (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => openCustomer(c.id, c.notes)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                          </div>
                          {c.notes && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <StickyNote className="w-3 h-3" />
                              Has notes
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{c.country || '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {c.totalOrders ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatKwd(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({total.toLocaleString()} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Sheet */}
      <Sheet open={selectedId !== null} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Detail
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-3 mt-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-6">
              {/* Profile */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Profile</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium mt-0.5">
                      {[detail.customer.firstName, detail.customer.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country</span>
                    <p className="font-medium mt-0.5">{detail.customer.country || '—'}</p>
                  </div>
                  {detail.customer.email && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{detail.customer.email}</span>
                    </div>
                  )}
                  {detail.customer.phone && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{detail.customer.phone}</span>
                    </div>
                  )}
                  {(detail.customer.area || detail.customer.block || detail.customer.street) && (
                    <div className="col-span-2 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {[detail.customer.block && `Block ${detail.customer.block}`,
                          detail.customer.street && `Street ${detail.customer.street}`,
                          detail.customer.avenue && `Ave ${detail.customer.avenue}`,
                          detail.customer.house && `House ${detail.customer.house}`,
                          detail.customer.area,
                        ].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Total Orders</div>
                  <div className="text-2xl font-bold mt-1">{detail.customer.totalOrders ?? 0}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                  <div className="text-lg font-bold mt-1">{formatKwd(detail.customer.totalSpent)}</div>
                </Card>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => recalcMutation.mutate({ id: detail.customer.id })}
                disabled={recalcMutation.isPending}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
                Recalculate Totals from Orders
              </Button>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Notes</h3>
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                      Edit
                    </Button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesEdit}
                      onChange={e => setNotesEdit(e.target.value)}
                      rows={4}
                      placeholder="Add notes about this customer..."
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateNotesMutation.mutate({ id: detail.customer.id, notes: notesEdit })}
                        disabled={updateNotesMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingNotes(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detail.customer.notes || 'No notes yet.'}
                  </p>
                )}
              </div>

              <Separator />

              {/* Order History */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Order History ({detail.orders.length})
                </h3>
                {detail.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders found.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.orders.map((o: NonNullable<typeof detail>['orders'][number]) => (
                      <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div>
                          <div className="font-mono font-medium">{o.orderNumber}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                            {' · '}{o.channel}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatKwd(o.total)}</div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor(o.status ?? '')}`}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
