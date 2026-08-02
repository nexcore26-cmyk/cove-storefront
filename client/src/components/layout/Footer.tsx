/**
 * Footer — Cove Interior
 * Desktop: 4 contact widgets in a horizontal row, background uses heaader.jpg
 * Mobile: vertical stack (unchanged)
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

// ─── SVG Icons (gold outlined style matching WP) ─────────────────────────────

function IconMapPin() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="34" rx="4" stroke="#9D7D39" strokeWidth="1.2" fill="none"/>
      <path d="M18 8C14.134 8 11 11.134 11 15c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="#9D7D39"/>
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="34" rx="4" stroke="#9D7D39" strokeWidth="1.2" fill="none"/>
      <path d="M13.5 10h-1a2 2 0 0 0-2 2v1c0 6.627 5.373 12 12 12h1a2 2 0 0 0 2-2v-1a1 1 0 0 0-.553-.894l-3-1.5a1 1 0 0 0-1.17.22l-.97 1.07A9.017 9.017 0 0 1 15.1 16.2l1.07-.97a1 1 0 0 0 .22-1.17l-1.5-3A1 1 0 0 0 13.5 10z" fill="#9D7D39"/>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="34" rx="4" stroke="#9D7D39" strokeWidth="1.2" fill="none"/>
      <rect x="9" y="12" width="18" height="13" rx="2" stroke="#9D7D39" strokeWidth="1.4" fill="none"/>
      <path d="M9 14l9 6 9-6" stroke="#9D7D39" strokeWidth="1.4" fill="none"/>
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="34" rx="4" stroke="#9D7D39" strokeWidth="1.2" fill="none"/>
      <rect x="10" y="10" width="16" height="16" rx="4" stroke="#9D7D39" strokeWidth="1.4" fill="none"/>
      <circle cx="18" cy="18" r="4" stroke="#9D7D39" strokeWidth="1.4" fill="none"/>
      <circle cx="23" cy="13" r="1" fill="#9D7D39"/>
    </svg>
  );
}

// ─── Payment badge SVGs ───────────────────────────────────────────────────────
function BadgeKnet() {
  return (
    <div style={{ background: '#000', borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', height: 28 }}>
      <svg width="44" height="18" viewBox="0 0 44 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="22" y="13" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="1">K-NET</text>
      </svg>
    </div>
  );
}

function BadgeMastercard() {
  return (
    <div style={{ background: '#000', borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', height: 28 }}>
      <svg width="38" height="22" viewBox="0 0 38 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="13" cy="11" r="10" fill="rgba(255,255,255,0.9)"/>
        <circle cx="25" cy="11" r="10" fill="rgba(255,255,255,0.7)"/>
        <path d="M19 4.8a10 10 0 0 1 0 12.4A10 10 0 0 1 19 4.8z" fill="rgba(255,255,255,0.55)"/>
      </svg>
    </div>
  );
}

function BadgeVisa() {
  return (
    <div style={{ background: '#000', borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', height: 28 }}>
      <svg width="44" height="14" viewBox="0 0 44 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="22" y="12" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="1">VISA</text>
      </svg>
    </div>
  );
}

function BadgeApplePay() {
  return (
    <div style={{ background: '#000', borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', height: 28 }}>
      <svg width="46" height="18" viewBox="0 0 46 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="23" y="13" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600" fontFamily="-apple-system,BlinkMacSystemFont,Arial,sans-serif" letterSpacing="0.3"> Pay</text>
        <text x="7" y="13" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="300" fontFamily="-apple-system,BlinkMacSystemFont,Arial,sans-serif"></text>
        <path d="M6 4.5C6.6 3.8 7 2.9 6.9 2c-.8.1-1.8.6-2.4 1.3-.5.6-.9 1.5-.8 2.4.9 0 1.7-.5 2.3-1.2zm.8 1.3c-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C-.1 5.9-1.3 7-1.3 9.2c0 3.4 3 7.3 4.3 7.3.6 0 1.3-.5 2.1-.5.8 0 1.3.5 2.1.5 1.3 0 4.1-3.7 4.1-7.1-.1 0-2.3-.9-2.5-3.6z" fill="#fff" transform="translate(3,0) scale(0.85)"/>
      </svg>
    </div>
  );
}

// ─── Footer component ─────────────────────────────────────────────────────────
export default function Footer() {
  const { data: savedSettings } = trpc.footerSettings.get.useQuery(undefined, { staleTime: 60_000, retry: false });
  const logoUrl = (savedSettings as any)?.logoUrl || '/brand/cove-logo.png';

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const HEADER_BG = '/media/admin-uploads/tenant-1/2026/07/heaader.jpg';

  // Contact widget data
  const widgets = [
    {
      icon: <IconMapPin />,
      href: 'https://maps.app.goo.gl/dfMyPhjT1eSz4tfG7',
      label: 'Location',
      external: true,
    },
    {
      icon: <IconPhone />,
      href: 'tel:+96522464414',
      label: '965 2246 4414',
      external: false,
    },
    {
      icon: <IconMail />,
      href: 'mailto:cove@coveinterior.com',
      label: 'cove@coveinterior.com',
      external: false,
    },
    {
      icon: <IconInstagram />,
      href: 'https://www.instagram.com/brass.official/',
      label: 'brass.official',
      external: true,
    },
  ];

  return (
    <footer
      style={{
        backgroundColor: '#0d0d0b',
        color: '#FAFAF8',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background image — using img tag for reliable mobile rendering */}
      <img
        src={HEADER_BG}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'right top',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Dark overlay so text stays readable over the image */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(10,10,8,0.55)', pointerEvents: 'none', zIndex: 1 }} />

      {/* Gold top border */}
      <div style={{ height: '1px', backgroundColor: '#9D7D39', position: 'relative', zIndex: 1 }} />

      {/* Contact info section */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: isDesktop ? 1100 : 600,
          margin: '0 auto',
          padding: isDesktop ? '48px 40px 40px' : '48px 24px 32px',
          display: isDesktop ? 'flex' : 'block',
          flexDirection: isDesktop ? 'row' : undefined,
          alignItems: isDesktop ? 'flex-start' : undefined,
          justifyContent: isDesktop ? 'space-between' : undefined,
          gap: isDesktop ? 24 : undefined,
        }}
      >
        {widgets.map((w, i) => (
          <a
            key={i}
            href={w.href}
            target={w.external ? '_blank' : undefined}
            rel={w.external ? 'noopener noreferrer' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexDirection: 'row',
              gap: 16,
              marginBottom: isDesktop ? 0 : 32,
              textDecoration: 'none',
              color: 'inherit',
              flex: isDesktop ? '1 1 0' : undefined,
              minWidth: 0,
            }}
          >
            <div style={{ flexShrink: 0 }}>{w.icon}</div>
            <p style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#FAFAF8',
              margin: 0,
              textAlign: isDesktop ? 'left' : undefined,
            }}>
              {w.label}
            </p>
          </a>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'rgba(157,125,57,0.25)', margin: '0 24px', position: 'relative', zIndex: 1 }} />

      {/* Bottom bar — logo, copyright, payment */}
      <div style={{ textAlign: 'center', padding: '40px 24px 32px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ marginBottom: 16 }}>
          <img
            src={logoUrl}
            alt="Cove Interior"
            style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'inline-block' }}
          />
        </div>

        {/* Copyright */}
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#8A8A82', margin: '0 0 12px' }}>
          Cove {new Date().getFullYear()} all copyrights reserved.
        </p>

        {/* Full address */}
        <a
          href="https://maps.app.goo.gl/dfMyPhjT1eSz4tfG7"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#8A8A82', textDecoration: 'none', display: 'block', margin: '0 0 24px' }}
        >
          Kuwait City, Murgab, Abdulla AL Mubarak St, Star Tower, Floor #11, Office #5.
        </a>

        {/* Payment badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <BadgeKnet />
          <BadgeMastercard />
          <BadgeVisa />
          <BadgeApplePay />
        </div>
      </div>
    </footer>
  );
}
