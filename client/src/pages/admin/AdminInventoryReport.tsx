import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Download, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

function exportCSV(filename: string, headers: string[], rows: (string | number)[][][]) {
  const flat = rows.flat();
  const csv = [headers.join(','), ...flat.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminInventoryReport() {
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const { data, isLoading } = trpc.analytics.inventoryReport.useQuery();

  const warehouses = data?.warehouses ?? [];
  const rows = (data?.rows ?? []).filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.sku ?? '').toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || warehouses.some(w => r.stock[w.id]?.isLow);
    return matchSearch && matchLow;
  });

  const lowCount = (data?.rows ?? []).filter(r => warehouses.some(w => r.stock[w.id]?.isLow)).length;

  const handleExport = () => {
    if (!data) return;
    const headers = ['Product', 'SKU', ...warehouses.map(w => `${w.name} (qty)`), ...warehouses.map(w => `${w.name} (low?)`)];
    const csvRows = data.rows.map(r => [[
      r.name,
      r.sku ?? '',
      ...warehouses.map(w => r.stock[w.id]?.qty ?? 0),
      ...warehouses.map(w => r.stock[w.id]?.isLow ? 'YES' : 'no'),
    ]]);
    exportCSV('inventory-report.csv', headers, csvRows);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Inventory Report</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}><Download size={14} className="mr-1" />Export CSV</Button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Products</p>
              <p className="text-2xl font-bold">{data.rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Low Stock Items</p>
              <p className="text-2xl font-bold text-amber-600">{lowCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search product or SKU…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
            <Button variant={showLowOnly ? 'default' : 'outline'} size="sm" onClick={() => setShowLowOnly(v => !v)}
              style={showLowOnly ? { backgroundColor: '#9D7D39', color: 'white' } : {}}>
              <AlertTriangle size={14} className="mr-1" />Low Stock Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={32} style={{ color: '#9D7D39' }} /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    {warehouses.map(w => (
                      <th key={w.id} className="px-4 py-3 font-medium text-right">{w.name}</th>
                    ))}
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={3 + warehouses.length} className="text-center py-8 text-muted-foreground">No products found</td></tr>
                  ) : rows.map((row) => {
                    const isAnyLow = warehouses.some(w => row.stock[w.id]?.isLow);
                    return (
                      <tr key={row.id} className={`border-b last:border-0 ${isAnyLow ? 'bg-amber-50/50' : 'hover:bg-muted/20'}`}>
                        <td className="px-4 py-2.5 font-medium max-w-xs truncate">{row.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{row.sku ?? '—'}</td>
                        {warehouses.map(w => {
                          const s = row.stock[w.id];
                          const qty = s?.qty ?? 0;
                          const isLow = s?.isLow ?? false;
                          return (
                            <td key={w.id} className="px-4 py-2.5 text-right">
                              <span className={`font-semibold ${isLow ? 'text-amber-600' : qty === 0 ? 'text-red-500' : ''}`}>{qty}</span>
                              {isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center">
                          {isAnyLow ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">Low Stock</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">OK</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
