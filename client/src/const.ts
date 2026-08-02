export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const getCurrentReturnPath = () => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
};

const getStaffLoginUrl = (returnPath?: string) => {
  const path = returnPath ?? getCurrentReturnPath();
  return `/staff-login?return=${encodeURIComponent(path)}`;
};

// Generate login URL at runtime so redirect URI reflects the current origin.
// If the OAuth environment is absent or malformed, fall back to Cove staff login
// instead of throwing during React render.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  if (!oauthPortalUrl || !appId) {
    return getStaffLoginUrl(returnPath);
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    // Encode both the redirectUri and the returnPath in state as JSON → base64
    const statePayload = JSON.stringify({ redirectUri, returnPath: returnPath ?? "/" });
    const state = btoa(statePayload);

    const url = new URL("app-auth", `${oauthPortalUrl.replace(/\/$/, "")}/`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return getStaffLoginUrl(returnPath);
  }
};
