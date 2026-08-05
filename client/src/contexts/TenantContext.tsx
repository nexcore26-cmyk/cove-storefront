import React, { createContext, useContext, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface TenantConfig {
  businessName: string;
  tagline: string | null;
  logoUrl: string | null;
  logoAltText: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  themeColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
  } | null;
  headingFontFamily: string | null;
  bodyFontFamily: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  socialLinks: Record<string, string> | null;
  copyrightText: string | null;
}

interface TenantContextType {
  config: TenantConfig | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = trpc.tenantBranding.getPublic.useQuery();
  const config = (data ?? null) as TenantConfig | null;

  useEffect(() => {
    if (!config) return;
    const root = document.documentElement;

    const colors = config.themeColors ?? {};
    if (colors.primary) root.style.setProperty("--brand-primary", colors.primary);
    if (colors.secondary) root.style.setProperty("--brand-secondary", colors.secondary);
    if (colors.accent) root.style.setProperty("--brand-accent", colors.accent);
    if (colors.background) root.style.setProperty("--brand-background", colors.background);
    if (colors.foreground) root.style.setProperty("--brand-foreground", colors.foreground);

    if (config.headingFontFamily) {
      root.style.setProperty("--font-display-family", `'${config.headingFontFamily}', Georgia, serif`);
    }
    if (config.bodyFontFamily) {
      root.style.setProperty("--font-body-family", `'${config.bodyFontFamily}', system-ui, sans-serif`);
    }
  }, [config]);

  return (
    <TenantContext.Provider value={{ config, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantConfig() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantConfig must be used within TenantProvider");
  }
  return context;
}
