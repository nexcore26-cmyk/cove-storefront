import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, FileArchive, FileText, Music, Search, Upload, Video, X } from 'lucide-react';
import { toast } from 'sonner';

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

type MediaPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  value?: string | string[];
  onSelect: (url: string, asset?: MediaAsset) => void;
  multiple?: boolean;
  accept?: string;
  entityType?: string;
  entityId?: number | null;
};

function asArray(value?: string | string[]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(value?: number | null) {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(asset: MediaAsset) {
  return Boolean(asset.mimeType?.startsWith('image/') || asset.url.match(/\.(png|jpe?g|webp|gif|svg)$/i));
}

function AssetThumb({ asset, picked, onClick }: { asset: MediaAsset; picked: boolean; onClick: () => void }) {
  const name = asset.originalFilename || asset.key || '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-sm border-2 bg-[#f0ece4] transition-all ${
        picked ? 'border-[#9D7D39] shadow-md' : 'border-transparent hover:border-[#9D7D39]/60'
      }`}
    >
      {/* Fixed square thumbnail */}
      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
        <div className="absolute inset-0">
          {isImage(asset) ? (
            <img
              src={asset.url}
              alt={asset.altText || name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9D7D39]">
              {(() => {
                const mime = asset.mimeType || '';
                const Icon = mime.includes('pdf') ? FileText : mime.startsWith('video/') ? Video : mime.startsWith('audio/') ? Music : FileArchive;
                return <Icon className="h-10 w-10" />;
              })()}
            </div>
          )}
        </div>
        {picked && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#9D7D39]/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9D7D39]">
              <Check className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
      </div>
      {/* Filename label */}
      <div className="bg-white px-1.5 py-1">
        <p className="truncate text-[11px] font-medium text-[#111110]" title={name}>{name}</p>
        <p className="text-[10px] text-[#8A8A82]">{formatBytes(asset.sizeBytes)}</p>
      </div>
    </button>
  );
}

export default function MediaPickerDialog({
  open,
  onOpenChange,
  title = 'Choose image',
  value,
  onSelect,
  multiple = false,
  accept = '*/*',
  entityType,
  entityId,
}: MediaPickerDialogProps) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('library');
  const [uploadingCount, setUploadingCount] = useState(0);
  const selected = useMemo(() => asArray(value), [value]);

  const { data: media = [], isLoading } = trpc.media.list.useQuery(
    { search: search || undefined, limit: 200 },
    { enabled: open }
  );

  const uploadMutation = trpc.media.upload.useMutation({
    onSuccess: (asset: any) => {
      utils.media.list.invalidate();
      onSelect(asset.url, asset);
      if (!multiple) onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    setUploadingCount(selectedFiles.length);
    try {
      const existingNames = new Set((media as MediaAsset[])
        .map((asset) => String(asset.originalFilename || '').toLowerCase())
        .filter(Boolean));
      for (const file of selectedFiles) {
        const fileDataUrl = await fileToDataUrl(file);
        let duplicateAction: 'error' | 'replace' | 'rename' = 'error';
        if (existingNames.has(file.name.toLowerCase())) {
          const choice = window.prompt(
            `Media Library already contains "${file.name}".\n\nType R to Replace, U to Upload a copy, or leave blank to cancel.`,
            'U'
          );
          if (choice === null || choice.trim() === '') continue;
          duplicateAction = choice.trim().toLowerCase().startsWith('r') ? 'replace' : 'rename';
        }
        const asset = await uploadMutation.mutateAsync({
          fileDataUrl,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          altText: file.name.replace(/\.[^.]+$/, ''),
          entityType,
          entityId: entityId ?? undefined,
          duplicateAction,
        } as any);
        existingNames.add(String((asset as any).originalFilename || file.name).toLowerCase());
      }
      toast.success(selectedFiles.length === 1 ? 'Media uploaded' : `${selectedFiles.length} files uploaded`);
      setActiveTab('library');
    } finally {
      setUploadingCount(0);
    }
  };

  const applyAsset = (asset: MediaAsset) => {
    onSelect(asset.url, asset);
    if (!multiple) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col overflow-hidden p-0" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-[#8A8A82] hover:bg-[#f0ece4] hover:text-[#111110]"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Tabs bar + search */}
          <div className="flex items-center justify-between border-b px-6">
            <TabsList className="h-auto rounded-none bg-transparent p-0">
              <TabsTrigger
                value="upload"
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-[#9D7D39] data-[state=active]:bg-transparent data-[state=active]:text-[#9D7D39]"
              >
                Upload files
              </TabsTrigger>
              <TabsTrigger
                value="library"
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-[#9D7D39] data-[state=active]:bg-transparent data-[state=active]:text-[#9D7D39]"
              >
                Media Library
              </TabsTrigger>
            </TabsList>
            {activeTab === 'library' && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8A8A82]" />
                <Input
                  className="h-9 pl-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search media…"
                />
              </div>
            )}
          </div>

          {/* Upload tab */}
          <TabsContent value="upload" className="m-0 flex-1 overflow-y-auto p-8">
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#D7C7A8] bg-[#FBF9F4] p-10 text-center">
              <Upload className="mb-4 h-12 w-12 text-[#9D7D39]" />
              <h3 className="text-lg font-medium">Drop files here or click to upload</h3>
              <p className="mt-2 max-w-md text-sm text-[#8A8A82]">Images, PDF, ZIP, video, audio — stored in the tenant media library and reusable across the site.</p>
              <Input
                className="mt-6 max-w-sm"
                type="file"
                multiple={multiple}
                accept={accept}
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploadingCount > 0 && (
                <p className="mt-3 text-sm text-[#9D7D39]">Uploading {uploadingCount} file{uploadingCount === 1 ? '' : 's'}…</p>
              )}
            </div>
          </TabsContent>

          {/* Library tab — full-width grid, no sidebar */}
          <TabsContent value="library" className="m-0 min-h-0 flex-1 overflow-y-auto">
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-sm text-[#8A8A82]">Loading media…</div>
              ) : (media as MediaAsset[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#D7C7A8] py-20 text-center text-sm text-[#8A8A82]">
                  <p className="font-medium">No media found</p>
                  <p className="mt-1">Use the Upload files tab to add images.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {(media as MediaAsset[]).map((asset) => (
                    <AssetThumb
                      key={asset.id}
                      asset={asset}
                      picked={selected.includes(asset.url)}
                      onClick={() => applyAsset(asset)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
