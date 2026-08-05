import { eq } from "drizzle-orm";
import { tenantBranding, tenants } from "../drizzle/schema";
import type { TenantBranding } from "../drizzle/schema";
import { getDb } from "./db";
import { matchTenantForHost, DEFAULT_TENANT_ID } from "./_core/context";

// Single source of truth for reading a tenant's branding config, shared by
// the public tRPC procedure (tenantBranding.getPublic) and the server-side
// index.html templating middleware, so the lookup logic isn't duplicated.
//
// Short in-process cache: this is read on every HTML page load and every
// client app mount, so we avoid hitting MySQL per request. TTL is short
// enough that an admin edit shows up almost immediately.
const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { row: TenantBranding | null; expiresAt: number }>();

export async function getTenantBranding(tenantId: number): Promise<TenantBranding | null> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.row;
  }

  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, tenantId))
    .limit(1);

  const result = row ?? null;
  cache.set(tenantId, { row: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function getTenantBrandingForHost(host: string | undefined): Promise<TenantBranding | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ id: tenants.id, rootDomain: tenants.rootDomain })
    .from(tenants);

  const matchedId = matchTenantForHost(host, rows) ?? DEFAULT_TENANT_ID;
  return getTenantBranding(matchedId);
}

// Call after any admin write to tenant_branding so the change is visible
// immediately instead of waiting out the cache TTL.
export function invalidateTenantBrandingCache(tenantId: number): void {
  cache.delete(tenantId);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Builds the Google Fonts <link> tag for a tenant's heading/body fonts, plus
// Noto Kufi Arabic (always included - the site's Arabic UI depends on it
// regardless of tenant). Falls back to Cove's current fonts so tenant 1
// renders identically before/after templating is introduced.
function buildFontLinks(headingFont: string | null | undefined, bodyFont: string | null | undefined): string {
  const heading = (headingFont || "Cormorant Garamond").trim().replace(/\s+/g, "+");
  const body = (bodyFont || "Montserrat").trim().replace(/\s+/g, "+");
  const families = [
    `family=${heading}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700`,
    `family=${body}:wght@300;400;500;600;700`,
    "family=Noto+Kufi+Arabic:wght@300;400;500;600;700",
  ];
  const href = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  return `<link href="${href}" rel="stylesheet" />`;
}

// Substitutes the %%TENANT_*%% placeholders in client/index.html with the
// resolved tenant's branding, so the initial HTML response (SEO meta tags,
// favicon, OG/Twitter cards, fonts) is correct per-tenant before any client
// JS runs - important for crawlers and social-share link previews. Shared by
// both the production static-serving path and the Vite dev-mode path.
export async function renderTenantIndexHtml(template: string, host: string | undefined): Promise<string> {
  const branding = await getTenantBrandingForHost(host);
  const businessName = branding?.businessName || "Store";
  const title = branding?.metaTitle || businessName;
  const description = branding?.metaDescription || "";
  const favicon = branding?.faviconUrl || "/favicon.ico";
  const ogImage = branding?.ogImageUrl || "";
  const fontLinks = buildFontLinks(branding?.headingFontFamily, branding?.bodyFontFamily);

  return template
    .replaceAll("%%TENANT_TITLE%%", escapeHtml(title))
    .replaceAll("%%TENANT_META_DESCRIPTION%%", escapeHtml(description))
    .replaceAll("%%TENANT_FAVICON%%", escapeHtml(favicon))
    .replaceAll("%%TENANT_OG_IMAGE%%", escapeHtml(ogImage))
    .replaceAll("%%TENANT_BUSINESS_NAME%%", escapeHtml(businessName))
    .replace("%%TENANT_FONT_LINKS%%", fontLinks);
}
