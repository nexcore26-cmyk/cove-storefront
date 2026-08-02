import { useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import MediaPickerDialog from '@/components/admin/MediaPickerDialog';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileArchive, FileText, Grid3X3, Image as ImageIcon, List, Music, Search, Upload, Video } from 'lucide-react';

type MediaAsset = {
  id: number;
  url: string;
  key?: string | null;
  mimeType?: string | null;
  originalFilename?: string | null;
  altText?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | Date | null;
};

function formatBytes(value?: number | null) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isImage(asset: MediaAsset) {
  return Boolean(asset.mimeType?.startsWith('image/') || asset.url.match(/\.(png|jpe?g|webp|gif|svg)$/i));
}

function typeLabel(asset: MediaAsset) {
  const mime = asset.mimeType || '';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('zip') || mime.includes('archive')) return 'Archive';
  return mime || 'File';
}

function AssetThumb({ asset }: { asset: MediaAsset }) {
  if (isImage(asset)) {
    return <img src={asset.url} alt={asset.altText || asset.originalFilename || 'Media'} className="h-36 w-full object-cover" />;
  }
  const mime = asset.mimeType || '';
  const Icon = mime.includes('pdf') ? FileText : mime.startsWith('video/') ? Video : mime.startsWith('audio/') ? Music : mime.includes('zip') ? FileArchive : ImageIcon;
  return (
    <div className="flex h-36 w-full items-center justify-center bg-[#F4F0E8] text-[#9D7D39]">
      <Icon className="h-12 w-12" />
    </div>
  );
}

export default function AdminMediaLibrary() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const { data: media = [], isLoading } = trpc.media.list.useQuery({ search: search || undefined, limit: 200 });
  const assets = media as MediaAsset[];
  const selectedAsset = useMemo(() => assets.find((asset) => asset.url === selectedUrl) || assets[0], [assets, selectedUrl]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#9D7D39]">Media</p>
            <h1 className="font-serif text-4xl text-[#1F1B16]">Media Library</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Tenant-specific library for images, PDF files, ZIP archives, video, audio, and other media used by products, menus, headers, footers, and page builder sections.</p>
          </div>
          <Button type="button" className="bg-[#111110] text-white hover:bg-[#9D7D39]" onClick={() => setPickerOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Add Media File
          </Button>
        </div>

        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[auto_auto_1fr] md:items-center">
            <div className="flex gap-1">
              <Button type="button" variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setView('list')} aria-label="List view">
                <List className="h-4 w-4" />
              </Button>
              <Button type="button" variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setView('grid')} aria-label="Grid view">
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option>All media items</option>
            </select>
            <div className="flex items-center gap-3 md:justify-end">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Search media</Label>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {isLoading ? (
              <p className="col-span-full text-sm text-muted-foreground">Loading media…</p>
            ) : assets.length === 0 ? (
              <div className="col-span-full rounded border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">No media has been uploaded for this tenant yet.</div>
            ) : (
              assets.map((asset) => (
                <button key={asset.id} type="button" onClick={() => setSelectedUrl(asset.url)} className={`overflow-hidden rounded border bg-white text-left shadow-sm transition hover:border-[#9D7D39] ${selectedUrl === asset.url ? 'border-[#9D7D39] ring-1 ring-[#9D7D39]' : ''}`}>
                  <AssetThumb asset={asset} />
                  <div className="p-3">
                    <p className="truncate text-sm font-medium" title={asset.originalFilename || asset.key || asset.url}>{asset.originalFilename || asset.key || asset.url}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBytes(asset.sizeBytes)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F0E8] text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">File</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Size</th>
                  <th className="px-4 py-3 text-left">Uploaded</th>
                  <th className="px-4 py-3 text-left">URL</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{asset.originalFilename || asset.key}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{typeLabel(asset)}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatBytes(asset.sizeBytes)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(asset.createdAt)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{asset.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedAsset && (
          <div className="rounded border bg-[#FBF9F4] p-5">
            <h2 className="font-serif text-2xl">Attachment details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="overflow-hidden rounded border bg-white"><AssetThumb asset={selectedAsset} /></div>
              <div className="space-y-1 text-sm">
                <p><strong>Filename:</strong> {selectedAsset.originalFilename || selectedAsset.key}</p>
                <p><strong>Type:</strong> {typeLabel(selectedAsset)}</p>
                <p><strong>Size:</strong> {formatBytes(selectedAsset.sizeBytes)}</p>
                <p><strong>URL:</strong> <span className="break-all text-muted-foreground">{selectedAsset.url}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add Media File"
        multiple
        value={[]}
        onSelect={(url) => setSelectedUrl(url)}
      />
    </AdminLayout>
  );
}
