// Storage helpers for tenant media and generated assets.
//
// When Forge/S3 configuration is present, uploads use the existing Forge
// presigned URL flow and are served through /manus-storage/{key}.
// When Forge/S3 configuration is absent, uploads fall back to local disk under
// <app_root>/public/media/{key} and are served through /media/{key}.

import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

type StoragePutOptions = {
  /**
   * Default keeps historical behavior by adding a random suffix.
   * Use "exact" when the caller has already resolved duplicate filenames,
   * for example admin media replacement or numbered-copy uploads.
   */
  naming?: "hash" | "exact";
};

function getForgeConfig(): { forgeUrl: string; forgeKey: string } | null {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    return null;
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.(?:\/|\\|$)/g, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function resolveStorageKey(relKey: string, options: StoragePutOptions = {}): string {
  const normalized = normalizeKey(relKey);
  return options.naming === "exact" ? normalized : appendHashSuffix(normalized);
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  return Buffer.from(data);
}

function mediaUrlForKey(key: string): string {
  return `/media/${key}`;
}

function manusStorageUrlForKey(key: string): string {
  return `/manus-storage/${key}`;
}

async function localStoragePut(
  key: string,
  data: Buffer | Uint8Array | string,
): Promise<{ key: string; url: string }> {
  const mediaRoot = path.join(process.cwd(), "public", "media");
  const filePath = path.join(mediaRoot, key);

  if (!filePath.startsWith(mediaRoot + path.sep)) {
    throw new Error("Invalid storage key");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, toBuffer(data));

  return { key, url: mediaUrlForKey(key) };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  options: StoragePutOptions = {},
): Promise<{ key: string; url: string }> {
  const key = resolveStorageKey(relKey, options);
  const forgeConfig = getForgeConfig();

  if (!forgeConfig) {
    return localStoragePut(key, data);
  }

  const { forgeUrl, forgeKey } = forgeConfig;

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: manusStorageUrlForKey(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: getForgeConfig() ? manusStorageUrlForKey(key) : mediaUrlForKey(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const forgeConfig = getForgeConfig();
  const key = normalizeKey(relKey);

  if (!forgeConfig) {
    return mediaUrlForKey(key);
  }

  const { forgeUrl, forgeKey } = forgeConfig;

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
