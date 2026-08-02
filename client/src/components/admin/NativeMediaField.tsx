import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImagePlus, Upload, X, Search, Check } from 'lucide-react';
import { toast } from 'sonner';

type NativeMediaFieldProps = {
  label: string;
  value: string | string[];
  onChange: (value: any) => void;
  multiple?: boolean;
  entityType?: string;
  entityId?: number | null;
  helperText?: string;
};

function asArray(value: string | string[]) {
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

export default function NativeMediaField({
  label,
  value,
  onChange,
  multiple = false,
  entityType,
  entityId,
  helperText,
}: NativeMediaFieldProps) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selected = asArray(value);

  const { data: media = [], isLoading } = trpc.media.list.useQuery(
    { search: search || undefined, limit: 60 },
    { enabled: open }
  );

  const uploadMutation = trpc.media.upload.useMutation({
    onSuccess: (asset) => {
      utils.media.list.invalidate();
      applyUrl(asset.url);
      toast.success('Media uploaded');
    },
    onError: (e) => toast.error(e.message),
  });

  const applyUrl = (url: string) => {
    if (!url) return;
    if (multiple) {
      onChange(Array.from(new Set([...selected, url])));
    } else {
      onChange(url);
      setOpen(false);
    }
  };

  const removeUrl = (url: string) => {
    if (multiple) onChange(selected.filter((item) => item !== url));
    else onChange('');
  };

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const existing = (media as any[]).find((asset) => String(asset.originalFilename || '').toLowerCase() === file.name.toLowerCase());
    let duplicateAction: 'error' | 'replace' | 'rename' = 'error';
    if (existing) {
      const choice = window.prompt(
        `Media Library already contains "${file.name}".\n\nType R to Replace the existing file, U to Upload a numbered copy, or leave blank to cancel.`,
        'U'
      );
      if (choice === null || choice.trim() === '') return;
      duplicateAction = choice.trim().toLowerCase().startsWith('r') ? 'replace' : 'rename';
    }
    const imageDataUrl = await fileToDataUrl(file);
    uploadMutation.mutate({
      imageDataUrl,
      filename: file.name,
      altText: label,
      entityType,
      entityId: entityId ?? undefined,
      duplicateAction,
    } as any);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{label}</Label>
          {helperText && <p className="text-xs text-muted-foreground mt-0.5">{helperText}</p>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ImagePlus className="w-4 h-4 mr-1.5" /> Browse / Upload
        </Button>
      </div>

      {selected.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {selected.map((url) => (
            <div key={url} className="relative rounded-md border bg-muted/20 p-2">
              <img src={url} alt="Selected media" className="w-full h-24 object-cover rounded" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removeUrl(url)}
              >
                <X className="w-3 h-3" />
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground truncate" title={url}>{url}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No media selected yet.
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{label} — Native Media Library</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <div className="space-y-1.5">
              <Label>Upload new native image</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground">Choose an image and it will be saved to the tenant media library.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1.5" /> {uploadMutation.isPending ? 'Uploading…' : 'Upload stores under /media'}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Search existing media</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by filename, alt text, or URL" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground col-span-full">Loading media…</p>
            ) : (media as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">No media found.</p>
            ) : (
              (media as any[]).map((asset) => {
                const picked = selected.includes(asset.url);
                return (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => applyUrl(asset.url)}
                    className={`relative text-left rounded-md border p-2 hover:border-primary ${picked ? 'border-primary ring-1 ring-primary' : ''}`}
                  >
                    <img src={asset.url} alt={asset.altText || asset.originalFilename || 'Media'} className="w-full h-28 object-cover rounded" />
                    {picked && <Check className="absolute top-2 right-2 w-5 h-5 text-primary bg-background rounded-full" />}
                    <p className="mt-1 text-xs font-medium truncate">{asset.originalFilename || asset.key}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{asset.url}</p>
                  </button>
                );
              })
            )}
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <Label>Manual native URL fallback</Label>
            <div className="flex gap-2">
              <Input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="/media/..." />
              <Button type="button" onClick={() => { applyUrl(manualUrl); setManualUrl(''); }}>Use URL</Button>
            </div>
            <p className="text-xs text-muted-foreground">Use this only for an existing Cove native media URL. New images should be uploaded above.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
