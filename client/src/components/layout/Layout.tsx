/**
 * Layout — Main wrapper with Header, Footer, and CartDrawer
 * Obsidian Editorial Design System
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import Header, { getHeaderDeviceHeight, normalizeHeaderSettings } from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import { trpc } from '@/lib/trpc';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: savedHeader } = trpc.headerSettings.get.useQuery(undefined, { staleTime: 60_000, retry: false });
  const headerSettings = useMemo(() => normalizeHeaderSettings(savedHeader), [savedHeader]);
  const desktopHeaderHeight = getHeaderDeviceHeight(headerSettings, 'desktop');
  const mobileHeaderHeight = getHeaderDeviceHeight(headerSettings, 'mobile');

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAFAF8' }}>
      <Header />
      <main
        className="flex-1 pt-[var(--cove-header-mobile-height)] lg:pt-[var(--cove-header-desktop-height)]"
        style={{
          '--cove-header-desktop-height': `${desktopHeaderHeight}px`,
          '--cove-header-mobile-height': `${mobileHeaderHeight}px`,
        } as CSSProperties}
      >
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
