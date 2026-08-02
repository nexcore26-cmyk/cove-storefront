import React, { useState, useEffect, useRef } from 'react';
import CovePageBuilder, { type PageBlock } from '@/components/admin/CovePageBuilder';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff,
  Edit2, Globe, FileText, LayoutGrid, Image, AlignLeft,
  Minus, MessageSquare, GalleryHorizontal, Layers, Save,
  PlusCircle, X
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Block type definitions ────────────────────────────────────────────────
const BLOCK_TYPES = [
  { value: 'hero_slider', label: 'Hero', icon: Image, description: 'Full-width hero section with slides' },
  { value: 'text_html', label: 'HTML Block', icon: AlignLeft, description: 'Rich text or HTML content' },
  { value: 'category_grid', label: 'Category Grid', icon: LayoutGrid, description: 'Grid of product categories' },
  { value: 'product_grid', label: 'Product Grid', icon: Layers, description: 'Grid of products' },
  { value: 'banner', label: 'Banner', icon: Image, description: 'Promotional banner with CTA' },
  { value: 'button', label: 'Button', icon: PlusCircle, description: 'Standalone call-to-action button' },
  { value: 'spacer', label: 'Spacer', icon: Minus, description: 'Vertical spacing' },
  { value: 'contact_form', label: 'Contact Form', icon: MessageSquare, description: 'Contact / inquiry form' },
  { value: 'image_gallery', label: 'Image Gallery', icon: GalleryHorizontal, description: 'Image gallery grid' },
  { value: 'intro_text', label: 'Intro Text', icon: AlignLeft, description: 'Centered intro section with heading and body text' },
  { value: 'nav_cards', label: 'Nav Cards', icon: LayoutGrid, description: 'Mosaic grid of 6 navigation cards with images' },
] as const;

type BlockType = typeof BLOCK_TYPES[number]['value'];

// ─── Default configs per block type ───────────────────────────────────────
function defaultConfig(type: BlockType): Record<string, any> {
  switch (type) {
    case 'hero_slider': return {
      slides: [{ image: '', title: 'Welcome to Cove Interior', subtitle: 'Luxury Furniture & Design', ctaText: 'Shop Now', ctaLink: '/shop' }],
      autoplay: true,
      interval: 5000,
    };
    case 'text_html': return { content: '<p>Enter your content here...</p>', contentAr: '' };
    case 'category_grid': return { categoryIds: [], columns: 4, showName: true };
    case 'product_grid': return { productIds: [], categoryId: null, limit: 8, columns: 4, title: 'Featured Products', titleAr: '' };
    case 'banner': return { image: '', title: 'Special Offer', titleAr: '', subtitle: '', ctaText: 'Shop Now', ctaLink: '/shop', overlay: true };
    case 'button': return { text: 'Learn More', textAr: '', href: '/shop', align: 'center', variant: 'primary', openInNewTab: false, fullWidth: false, paddingY: 40 };
    case 'spacer': return { height: 60 };
    case 'contact_form': return { title: 'Contact Us', titleAr: 'اتصل بنا', fields: ['name', 'email', 'phone', 'message'], submitLabel: 'Send Message' };
    case 'image_gallery': return { images: [], columns: 3 };
    case 'intro_text': return {
      label: 'TIMELESS DESIGN, DISTINCTIVE LIVING.',
      heading: 'Discover the World of Cove',
      body1: 'Step into a world of refined interiors, distinctive craftsmanship and thoughtfully curated design. From signature brass furniture to complete interior solutions, every detail is created to bring elegance, character and individuality to your space.',
      body2: 'Timeless design, carefully considered and uniquely Cove.',
    };
    case 'nav_cards': return {
      cards: [
        { title: 'Signature Brass Furniture', description: 'Distinctive brass pieces designed to bring warmth, character and timeless elegance.', cta: 'Explore Collection', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/signaturebrassfurniture.png' },
        { title: 'Company Portfolio', description: 'Explore residential, commercial and bespoke interiors.', cta: 'View Portfolio', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/companyportfolio.png' },
        { title: 'Client Services', description: 'Concept, design and execution tailored to your space.', cta: 'Explore Services', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/clientservices.png' },
        { title: 'About Cove', description: 'The story, the craft and the people behind Cove Interior.', cta: 'Discover Cove', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/aboutcove.png' },
        { title: 'Cove Events', description: 'Curated gatherings and exclusive Cove experiences.', cta: 'View Events', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/coveevents.png' },
        { title: 'Visit & Contact Cove', description: 'Find us, reach out and begin your journey with Cove.', cta: 'Contact Us', link: '#', image: '/media/admin-uploads/tenant-1/2026/07/visitcontactcove.png' },
      ],
    };
    default: return {};
  }
}

// ─── Block config form components ─────────────────────────────────────────
function HeroSliderConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const slides = config.slides || [];
  const addSlide = () => onChange({ ...config, slides: [...slides, { image: '', title: '', subtitle: '', ctaText: 'Shop Now', ctaLink: '/shop' }] });
  const removeSlide = (i: number) => onChange({ ...config, slides: slides.filter((_: any, idx: number) => idx !== i) });
  const updateSlide = (i: number, field: string, val: string) => {
    const updated = slides.map((s: any, idx: number) => idx === i ? { ...s, [field]: val } : s);
    onChange({ ...config, slides: updated });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={config.autoplay ?? true} onCheckedChange={v => onChange({ ...config, autoplay: v })} />
          <Label>Autoplay</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label>Interval (ms)</Label>
          <Input type="number" className="w-24" value={config.interval ?? 5000} onChange={e => onChange({ ...config, interval: Number(e.target.value) })} />
        </div>
      </div>
      {slides.map((slide: any, i: number) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Slide {i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => removeSlide(i)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Image URL</Label><Input value={slide.image} onChange={e => updateSlide(i, 'image', e.target.value)} placeholder="https://..." /></div>
            <div><Label className="text-xs">Title</Label><Input value={slide.title} onChange={e => updateSlide(i, 'title', e.target.value)} /></div>
            <div><Label className="text-xs">Subtitle</Label><Input value={slide.subtitle} onChange={e => updateSlide(i, 'subtitle', e.target.value)} /></div>
            <div><Label className="text-xs">CTA Text</Label><Input value={slide.ctaText} onChange={e => updateSlide(i, 'ctaText', e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">CTA Link</Label><Input value={slide.ctaLink} onChange={e => updateSlide(i, 'ctaLink', e.target.value)} /></div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addSlide}><Plus className="h-4 w-4 mr-1" />Add Slide</Button>
    </div>
  );
}

function TextHtmlConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Content (HTML/Text) — English</Label>
        <Textarea rows={6} value={config.content ?? ''} onChange={e => onChange({ ...config, content: e.target.value })} placeholder="<p>Your content here...</p>" className="font-mono text-sm" />
      </div>
      <div>
        <Label>Content — Arabic (optional)</Label>
        <Textarea rows={4} value={config.contentAr ?? ''} onChange={e => onChange({ ...config, contentAr: e.target.value })} placeholder="المحتوى بالعربية..." dir="rtl" className="font-mono text-sm" />
      </div>
    </div>
  );
}

function CategoryGridConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const { data: categories } = trpc.categories.list.useQuery();
  const ids: number[] = config.categoryIds || [];
  const toggle = (id: number) => {
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    onChange({ ...config, categoryIds: next });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div><Label className="text-xs">Columns</Label>
          <Select value={String(config.columns ?? 4)} onValueChange={v => onChange({ ...config, columns: Number(v) })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>{[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Switch checked={config.showName ?? true} onCheckedChange={v => onChange({ ...config, showName: v })} />
          <Label>Show Category Name</Label>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Select Categories (leave empty to show all)</Label>
        <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border rounded p-2">
          {(categories || []).map((cat: any) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
              <input type="checkbox" checked={ids.includes(cat.id)} onChange={() => toggle(cat.id)} />
              {cat.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductGridConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const { data: categories } = trpc.categories.list.useQuery();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Title (EN)</Label><Input value={config.title ?? ''} onChange={e => onChange({ ...config, title: e.target.value })} /></div>
        <div><Label className="text-xs">Title (AR)</Label><Input value={config.titleAr ?? ''} onChange={e => onChange({ ...config, titleAr: e.target.value })} dir="rtl" /></div>
        <div>
          <Label className="text-xs">Filter by Category</Label>
          <Select value={config.categoryId ? String(config.categoryId) : 'all'} onValueChange={v => onChange({ ...config, categoryId: v === 'all' ? null : Number(v) })}>
            <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories || []).map((cat: any) => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Limit</Label><Input type="number" value={config.limit ?? 8} onChange={e => onChange({ ...config, limit: Number(e.target.value) })} /></div>
        <div>
          <Label className="text-xs">Columns</Label>
          <Select value={String(config.columns ?? 4)} onValueChange={v => onChange({ ...config, columns: Number(v) })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>{[2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function BannerConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Image URL</Label><Input value={config.image ?? ''} onChange={e => onChange({ ...config, image: e.target.value })} placeholder="https://..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Title (EN)</Label><Input value={config.title ?? ''} onChange={e => onChange({ ...config, title: e.target.value })} /></div>
        <div><Label className="text-xs">Title (AR)</Label><Input value={config.titleAr ?? ''} onChange={e => onChange({ ...config, titleAr: e.target.value })} dir="rtl" /></div>
        <div><Label className="text-xs">Subtitle</Label><Input value={config.subtitle ?? ''} onChange={e => onChange({ ...config, subtitle: e.target.value })} /></div>
        <div><Label className="text-xs">CTA Text</Label><Input value={config.ctaText ?? ''} onChange={e => onChange({ ...config, ctaText: e.target.value })} /></div>
        <div><Label className="text-xs">CTA Link</Label><Input value={config.ctaLink ?? ''} onChange={e => onChange({ ...config, ctaLink: e.target.value })} /></div>
        <div className="flex items-center gap-2 mt-4">
          <Switch checked={config.overlay ?? true} onCheckedChange={v => onChange({ ...config, overlay: v })} />
          <Label>Dark Overlay</Label>
        </div>
      </div>
    </div>
  );
}

function ButtonConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Button Text (EN)</Label><Input value={config.text ?? ''} onChange={e => onChange({ ...config, text: e.target.value })} /></div>
        <div><Label className="text-xs">Button Text (AR)</Label><Input value={config.textAr ?? ''} onChange={e => onChange({ ...config, textAr: e.target.value })} dir="rtl" /></div>
        <div className="col-span-2"><Label className="text-xs">Link</Label><Input value={config.href ?? ''} onChange={e => onChange({ ...config, href: e.target.value })} placeholder="/shop or https://..." /></div>
        <div>
          <Label className="text-xs">Alignment</Label>
          <Select value={config.align ?? 'center'} onValueChange={v => onChange({ ...config, align: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Style</Label>
          <Select value={config.variant ?? 'primary'} onValueChange={v => onChange({ ...config, variant: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="ghost">Ghost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Vertical Padding (px)</Label><Input type="number" value={config.paddingY ?? 40} onChange={e => onChange({ ...config, paddingY: Number(e.target.value) })} /></div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={config.openInNewTab ?? false} onCheckedChange={v => onChange({ ...config, openInNewTab: v })} />
          <Label>Open in new tab</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={config.fullWidth ?? false} onCheckedChange={v => onChange({ ...config, fullWidth: v })} />
          <Label>Full width</Label>
        </div>
      </div>
    </div>
  );
}

function SpacerConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label>Height (px)</Label>
      <Input type="number" className="w-24" value={config.height ?? 60} onChange={e => onChange({ ...config, height: Number(e.target.value) })} />
    </div>
  );
}

function ContactFormConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const allFields = ['name', 'email', 'phone', 'subject', 'message'];
  const fields: string[] = config.fields || ['name', 'email', 'message'];
  const toggle = (f: string) => {
    const next = fields.includes(f) ? fields.filter(x => x !== f) : [...fields, f];
    onChange({ ...config, fields: next });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Title (EN)</Label><Input value={config.title ?? 'Contact Us'} onChange={e => onChange({ ...config, title: e.target.value })} /></div>
        <div><Label className="text-xs">Title (AR)</Label><Input value={config.titleAr ?? ''} onChange={e => onChange({ ...config, titleAr: e.target.value })} dir="rtl" /></div>
        <div><Label className="text-xs">Submit Button Label</Label><Input value={config.submitLabel ?? 'Send Message'} onChange={e => onChange({ ...config, submitLabel: e.target.value })} /></div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Fields</Label>
        <div className="flex gap-3 flex-wrap">
          {allFields.map(f => (
            <label key={f} className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={fields.includes(f)} onChange={() => toggle(f)} />
              {f}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageGalleryConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const images: string[] = config.images || [];
  const addImage = () => onChange({ ...config, images: [...images, ''] });
  const removeImage = (i: number) => onChange({ ...config, images: images.filter((_: string, idx: number) => idx !== i) });
  const updateImage = (i: number, val: string) => onChange({ ...config, images: images.map((img: string, idx: number) => idx === i ? val : img) });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label className="text-xs">Columns</Label>
        <Select value={String(config.columns ?? 3)} onValueChange={v => onChange({ ...config, columns: Number(v) })}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {images.map((img: string, i: number) => (
          <div key={i} className="flex gap-2">
            <Input value={img} onChange={e => updateImage(i, e.target.value)} placeholder="https://..." />
            <Button variant="ghost" size="sm" onClick={() => removeImage(i)}><X className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addImage}><Plus className="h-4 w-4 mr-1" />Add Image</Button>
    </div>
  );
}

function IntroTextConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">English</p>
      <div><Label className="text-xs">Golden Label (top)</Label><Input value={config.label ?? ''} onChange={e => onChange({ ...config, label: e.target.value })} placeholder="TIMELESS DESIGN, DISTINCTIVE LIVING." /></div>
      <div><Label className="text-xs">Heading</Label><Input value={config.heading ?? ''} onChange={e => onChange({ ...config, heading: e.target.value })} placeholder="Discover the World of Cove" /></div>
      <div><Label className="text-xs">Body Paragraph 1</Label><Textarea rows={3} value={config.body1 ?? ''} onChange={e => onChange({ ...config, body1: e.target.value })} /></div>
      <div><Label className="text-xs">Body Paragraph 2 (italic gold tagline)</Label><Input value={config.body2 ?? ''} onChange={e => onChange({ ...config, body2: e.target.value })} /></div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1 mt-4">Arabic عربي</p>
      <div><Label className="text-xs">التسمية الذهبية (Label)</Label><Input dir="rtl" value={config.labelAr ?? ''} onChange={e => onChange({ ...config, labelAr: e.target.value })} placeholder="تصميم خالد، حياة متميزة." /></div>
      <div><Label className="text-xs">العنوان (Heading)</Label><Input dir="rtl" value={config.headingAr ?? ''} onChange={e => onChange({ ...config, headingAr: e.target.value })} placeholder="اكتشف عالم كوف" /></div>
      <div><Label className="text-xs">الفقرة الأولى (Body 1)</Label><Textarea rows={3} dir="rtl" value={config.body1Ar ?? ''} onChange={e => onChange({ ...config, body1Ar: e.target.value })} /></div>
      <div><Label className="text-xs">الفقرة الثانية ذهبية (Body 2)</Label><Input dir="rtl" value={config.body2Ar ?? ''} onChange={e => onChange({ ...config, body2Ar: e.target.value })} /></div>
    </div>
  );
}

function NavCardsConfig({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const cards: any[] = config.cards || [];
  const updateCard = (i: number, field: string, val: string) => {
    const next = cards.map((c: any, idx: number) => idx === i ? { ...c, [field]: val } : c);
    onChange({ ...config, cards: next });
  };
  const cardLabels = [
    'Card 1 — Signature Brass Furniture (tall left)',
    'Card 2 — Company Portfolio (right top)',
    'Card 3 — Client Services (right bottom)',
    'Card 4 — About Cove (bottom left)',
    'Card 5 — Cove Events (bottom center)',
    'Card 6 — Visit & Contact Cove (bottom right)',
  ];
  return (
    <div className="space-y-5">
      {cards.map((card: any, i: number) => (
        <div key={i} className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">{cardLabels[i]}</p>

          {/* Image & Link */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label className="text-xs">Image URL</Label><Input value={card.image ?? ''} onChange={e => updateCard(i, 'image', e.target.value)} placeholder="/media/admin-uploads/..." /></div>
            <div className="col-span-2"><Label className="text-xs">Link (URL)</Label><Input value={card.link ?? '#'} onChange={e => updateCard(i, 'link', e.target.value)} placeholder="/pages/collections" /></div>
          </div>

          {/* English */}
          <p className="text-xs font-medium text-muted-foreground">English</p>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Title</Label><Input value={card.title ?? ''} onChange={e => updateCard(i, 'title', e.target.value)} /></div>
            <div><Label className="text-xs">CTA Text</Label><Input value={card.cta ?? ''} onChange={e => updateCard(i, 'cta', e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Description</Label><Textarea rows={2} value={card.description ?? ''} onChange={e => updateCard(i, 'description', e.target.value)} /></div>
          </div>

          {/* Arabic */}
          <p className="text-xs font-medium text-muted-foreground">عربي Arabic</p>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">العنوان</Label><Input dir="rtl" value={card.titleAr ?? ''} onChange={e => updateCard(i, 'titleAr', e.target.value)} /></div>
            <div><Label className="text-xs">نص الزر</Label><Input dir="rtl" value={card.ctaAr ?? ''} onChange={e => updateCard(i, 'ctaAr', e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">الوصف</Label><Textarea rows={2} dir="rtl" value={card.descriptionAr ?? ''} onChange={e => updateCard(i, 'descriptionAr', e.target.value)} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockConfigForm({ block, onChange }: { block: any; onChange: (config: any) => void }) {
  const config = block.config || {};
  switch (block.blockType) {
    case 'hero_slider': return <HeroSliderConfig config={config} onChange={onChange} />;
    case 'text_html': return <TextHtmlConfig config={config} onChange={onChange} />;
    case 'category_grid': return <CategoryGridConfig config={config} onChange={onChange} />;
    case 'product_grid': return <ProductGridConfig config={config} onChange={onChange} />;
    case 'banner': return <BannerConfig config={config} onChange={onChange} />;
    case 'button': return <ButtonConfig config={config} onChange={onChange} />;
    case 'spacer': return <SpacerConfig config={config} onChange={onChange} />;
    case 'contact_form': return <ContactFormConfig config={config} onChange={onChange} />;
    case 'image_gallery': return <ImageGalleryConfig config={config} onChange={onChange} />;
    case 'intro_text': return <IntroTextConfig config={config} onChange={onChange} />;
    case 'nav_cards': return <NavCardsConfig config={config} onChange={onChange} />;
    default: return <p className="text-sm text-muted-foreground">No config for this block type.</p>;
  }
}

// ─── Main component ────────────────────────────────────────────────────────
export default function AdminPageBuilder() {
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [editingBlockConfig, setEditingBlockConfig] = useState<any>({});
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [showAddBlockDialog, setShowAddBlockDialog] = useState(false);
  const [newPage, setNewPage] = useState({ slug: '', title: '', titleAr: '' });
  const [editingPageMeta, setEditingPageMeta] = useState<any | null>(null);
  const [editorMode, setEditorMode] = useState<'blocks' | 'visual'>('visual');
  const [coveBlocks, setCoveBlocks] = useState<PageBlock[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const utils = trpc.useUtils();
  const { data: pages, isLoading: pagesLoading } = trpc.pageBuilder.listPages.useQuery();
  const selectedPage = pages?.find(p => p.id === selectedPageId);

  const { data: pageWithBlocks, isLoading: blocksLoading } = trpc.pageBuilder.getPage.useQuery(
    { slug: selectedPage?.slug ?? '' },
    { enabled: !!selectedPage?.slug }
  );

  const createPage = trpc.pageBuilder.createPage.useMutation({
    onSuccess: () => {
      utils.pageBuilder.listPages.invalidate();
      setShowNewPageDialog(false);
      setNewPage({ slug: '', title: '', titleAr: '' });
      toast.success('Page created');
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePage = trpc.pageBuilder.updatePage.useMutation({
    onSuccess: () => {
      utils.pageBuilder.listPages.invalidate();
      setEditingPageMeta(null);
      toast.success('Page updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePage = trpc.pageBuilder.deletePage.useMutation({
    onSuccess: () => {
      utils.pageBuilder.listPages.invalidate();
      setSelectedPageId(null);
      toast.success('Page deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const addBlock = trpc.pageBuilder.addBlock.useMutation({
    onSuccess: () => {
      if (selectedPage) utils.pageBuilder.getPage.invalidate({ slug: selectedPage.slug });
      setShowAddBlockDialog(false);
      toast.success('Block added');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBlock = trpc.pageBuilder.updateBlock.useMutation({
    onSuccess: () => {
      if (selectedPage) utils.pageBuilder.getPage.invalidate({ slug: selectedPage.slug });
      setEditingBlock(null);
      toast.success('Block saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBlock = trpc.pageBuilder.deleteBlock.useMutation({
    onSuccess: () => {
      if (selectedPage) utils.pageBuilder.getPage.invalidate({ slug: selectedPage.slug });
      toast.success('Block deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderBlocks = trpc.pageBuilder.reorderBlocks.useMutation({
    onSuccess: () => {
      if (selectedPage) utils.pageBuilder.getPage.invalidate({ slug: selectedPage.slug });
    },
  });

  const saveCoveBlocks = trpc.pageBuilder.savePuckData.useMutation({
    onSuccess: async () => {
      if (selectedPage) {
        await utils.pageBuilder.getPage.invalidate({ slug: selectedPage.slug });
        await utils.pageBuilder.listPages.invalidate();
      }
      toast.success('Page published successfully');
    },
    onError: (e) => toast.error(e.message || 'Failed to publish page'),
  });

  const blocks = pageWithBlocks?.blocks || [];

  const moveBlock = (id: number, direction: 'up' | 'down') => {
    const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(b => b.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = sorted.map((b, i) => {
      if (i === idx) return { id: b.id, sortOrder: sorted[swapIdx].sortOrder };
      if (i === swapIdx) return { id: b.id, sortOrder: sorted[idx].sortOrder };
      return { id: b.id, sortOrder: b.sortOrder };
    });
    reorderBlocks.mutate({ blocks: newOrder });
  };

  const openEditBlock = (block: any) => {
    setEditingBlock(block);
    setEditingBlockConfig(block.config || {});
  };

  const handleSaveBlock = () => {
    if (!editingBlock) return;
    updateBlock.mutate({ id: editingBlock.id, config: editingBlockConfig });
  };

  const getBlockIcon = (type: string) => {
    const found = BLOCK_TYPES.find(b => b.value === type);
    const Icon = found?.icon || Layers;
    return <Icon className="h-4 w-4" />;
  };

  const getBlockLabel = (type: string) => BLOCK_TYPES.find(b => b.value === type)?.label || type;

  const handlePublishCoveBlocks = (blocks: PageBlock[]) => {
    if (!selectedPage) return;
    setCoveBlocks(blocks);
    // Store cove blocks as puckData JSON for compatibility with existing DB column
    saveCoveBlocks.mutate({ pageId: selectedPage.id, puckData: { content: blocks, root: { props: { title: selectedPage.title } }, _coveBuilder: true } as any });
  };

  // Auto-select first page
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages]);

  useEffect(() => {
    const raw = pageWithBlocks?.puckData as any;
    if (raw && raw._coveBuilder && Array.isArray(raw.content)) {
      setCoveBlocks(raw.content as PageBlock[]);
    } else {
      setCoveBlocks([]);
    }
  }, [pageWithBlocks?.id, pageWithBlocks?.puckData]);

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left panel: pages list */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-10'} border-r bg-muted/20 flex flex-col transition-all duration-200 overflow-hidden`}>
          <div className="p-3 border-b flex items-center justify-between shrink-0">
            {sidebarOpen && <h2 className="font-semibold text-sm">Pages</h2>}
            <div className="flex items-center gap-1 ml-auto">
              {sidebarOpen && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setShowNewPageDialog(true)}>
                  <PlusCircle className="h-3 w-3 mr-1" />New
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {pagesLoading ? (
              <div className="text-sm text-muted-foreground p-2">Loading...</div>
            ) : pages?.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">No pages yet.</div>
            ) : (
              pages?.map(page => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedPageId === page.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {page.isSystem ? <Globe className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{page.title}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-xs ${selectedPageId === page.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      /{page.slug}
                    </span>
                    {!page.isPublished && (
                      <Badge variant="secondary" className="text-xs py-0 h-4">Draft</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: block editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedPage ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a page to edit its blocks</p>
              </div>
            </div>
          ) : (
            <>
              {/* Page header */}
              <div className="border-b p-4 flex items-center justify-between bg-background">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">{selectedPage.title}</h1>
                    {selectedPage.isSystem && <Badge variant="outline" className="text-xs">System</Badge>}
                    <Badge variant={selectedPage.isPublished ? 'default' : 'secondary'} className="text-xs">
                      {selectedPage.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">/{selectedPage.slug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-md border bg-muted/30 p-0.5">
                    <Button variant={editorMode === 'visual' ? 'default' : 'ghost'} size="sm" onClick={() => setEditorMode('visual')}>
                      Visual Builder
                    </Button>
                    <Button variant={editorMode === 'blocks' ? 'default' : 'ghost'} size="sm" onClick={() => setEditorMode('blocks')}>
                      Legacy Blocks
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingPageMeta(selectedPage)}>
                    <Edit2 className="h-4 w-4 mr-1" />Edit Page
                  </Button>
                  {editorMode === 'blocks' && (
                    <Button size="sm" onClick={() => setShowAddBlockDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />Add Block
                    </Button>
                  )}
                </div>
              </div>

              {editorMode === 'visual' ? (
                <div className="flex-1 overflow-hidden">
                  <CovePageBuilder
                    initialBlocks={coveBlocks}
                    onPublish={handlePublishCoveBlocks}
                    isSaving={saveCoveBlocks.isPending}
                  />
                </div>
              ) : (
              <>
              {/* Blocks list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {blocksLoading ? (
                  <div className="text-sm text-muted-foreground">Loading blocks...</div>
                ) : blocks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="mb-3">No blocks yet. Add your first block to get started.</p>
                    <Button onClick={() => setShowAddBlockDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />Add Block
                    </Button>
                  </div>
                ) : (
                  [...blocks]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((block, idx) => (
                      <div
                        key={block.id}
                        className={`border rounded-lg bg-background transition-opacity ${!block.isVisible ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex flex-col gap-0.5">
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveBlock(block.id, 'up')} disabled={idx === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveBlock(block.id, 'down')} disabled={idx === blocks.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              {getBlockIcon(block.blockType)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{getBlockLabel(block.blockType)}</p>
                              <p className="text-xs text-muted-foreground">Sort: {block.sortOrder}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateBlock.mutate({ id: block.id, isVisible: !block.isVisible })}
                              title={block.isVisible ? 'Hide block' : 'Show block'}
                            >
                              {block.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditBlock(block)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('Delete this block?')) deleteBlock.mutate({ id: block.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Mini preview of config */}
                        <div className="px-3 pb-3 text-xs text-muted-foreground border-t pt-2">
                          {block.blockType === 'hero_slider' && `${block.config?.slides?.length ?? 0} slide(s)`}
                          {block.blockType === 'text_html' && (block.config?.content?.substring(0, 60) + '...')}
                          {block.blockType === 'category_grid' && `${block.config?.categoryIds?.length ?? 0} categories, ${block.config?.columns ?? 4} cols`}
                          {block.blockType === 'product_grid' && `${block.config?.title || 'Products'} — limit ${block.config?.limit ?? 8}`}
                          {block.blockType === 'banner' && (block.config?.title || 'Banner')}
                          {block.blockType === 'button' && `${block.config?.text || 'Button'} → ${block.config?.href || '#'}`}
                          {block.blockType === 'spacer' && `${block.config?.height ?? 60}px`}
                          {block.blockType === 'contact_form' && (block.config?.title || 'Contact Form')}
                          {block.blockType === 'image_gallery' && `${block.config?.images?.length ?? 0} image(s)`}
                        </div>
                      </div>
                    ))
                )}
              </div>
              </>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Page Dialog */}
      <Dialog open={showNewPageDialog} onOpenChange={setShowNewPageDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title (English)</Label><Input value={newPage.title} onChange={e => setNewPage(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Title (Arabic)</Label><Input value={newPage.titleAr} onChange={e => setNewPage(p => ({ ...p, titleAr: e.target.value }))} dir="rtl" /></div>
            <div>
              <Label>Slug (URL path)</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/pages/</span>
                <Input value={newPage.slug} onChange={e => setNewPage(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} placeholder="about-us" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPageDialog(false)}>Cancel</Button>
            <Button onClick={() => createPage.mutate({ ...newPage, isPublished: true })} disabled={!newPage.title || !newPage.slug || createPage.isPending}>
              {createPage.isPending ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Meta Dialog */}
      <Dialog open={!!editingPageMeta} onOpenChange={v => !v && setEditingPageMeta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Page Settings</DialogTitle></DialogHeader>
          {editingPageMeta && (
            <div className="space-y-3">
              <div><Label>Title (English)</Label><Input value={editingPageMeta.title} onChange={e => setEditingPageMeta((p: any) => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Title (Arabic)</Label><Input value={editingPageMeta.titleAr ?? ''} onChange={e => setEditingPageMeta((p: any) => ({ ...p, titleAr: e.target.value }))} dir="rtl" /></div>
              {!editingPageMeta.isSystem && (
                <div>
                  <Label>Slug</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">/pages/</span>
                    <Input value={editingPageMeta.slug} onChange={e => setEditingPageMeta((p: any) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} />
                  </div>
                </div>
              )}
              <div><Label>Meta Title</Label><Input value={editingPageMeta.metaTitle ?? ''} onChange={e => setEditingPageMeta((p: any) => ({ ...p, metaTitle: e.target.value }))} /></div>
              <div><Label>Meta Description</Label><Textarea value={editingPageMeta.metaDescription ?? ''} onChange={e => setEditingPageMeta((p: any) => ({ ...p, metaDescription: e.target.value }))} rows={2} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPageMeta.isPublished} onCheckedChange={v => setEditingPageMeta((p: any) => ({ ...p, isPublished: v }))} />
                <Label>Published</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPageMeta(null)}>Cancel</Button>
            {editingPageMeta && !editingPageMeta.isSystem && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Delete this page and all its blocks?')) {
                    deletePage.mutate({ id: editingPageMeta.id });
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            )}
            <Button
              onClick={() => editingPageMeta && updatePage.mutate({
                id: editingPageMeta.id,
                title: editingPageMeta.title,
                titleAr: editingPageMeta.titleAr || undefined,
                slug: editingPageMeta.slug,
                isPublished: editingPageMeta.isPublished,
                metaTitle: editingPageMeta.metaTitle || undefined,
                metaDescription: editingPageMeta.metaDescription || undefined,
              })}
              disabled={updatePage.isPending}
            >
              <Save className="h-4 w-4 mr-1" />{updatePage.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Block Dialog */}
      <Dialog open={showAddBlockDialog} onOpenChange={setShowAddBlockDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Block</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {BLOCK_TYPES.map(bt => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.value}
                  onClick={() => {
                    if (!selectedPage) return;
                    const nextOrder = blocks.length > 0 ? Math.max(...blocks.map(b => b.sortOrder)) + 10 : 0;
                    addBlock.mutate({
                      pageId: selectedPage.id,
                      blockType: bt.value,
                      sortOrder: nextOrder,
                      config: defaultConfig(bt.value),
                    });
                  }}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 text-left transition-colors"
                >
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{bt.label}</p>
                    <p className="text-xs text-muted-foreground">{bt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Block Dialog */}
      <Dialog open={!!editingBlock} onOpenChange={v => !v && setEditingBlock(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Block: {editingBlock ? getBlockLabel(editingBlock.blockType) : ''}</DialogTitle>
          </DialogHeader>
          {editingBlock && (
            <BlockConfigForm
              block={{ ...editingBlock, config: editingBlockConfig }}
              onChange={setEditingBlockConfig}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBlock(null)}>Cancel</Button>
            <Button onClick={handleSaveBlock} disabled={updateBlock.isPending}>
              <Save className="h-4 w-4 mr-1" />{updateBlock.isPending ? 'Saving...' : 'Save Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
