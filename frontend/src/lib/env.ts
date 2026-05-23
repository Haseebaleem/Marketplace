const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const env = {
  API_URL: apiUrl,
  /** Strips the trailing `/api/v1` so we can build asset URLs at the root. */
  ASSET_URL:
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    apiUrl.replace(/\/api\/v\d+$/, ""),
};

export const assetUrl = (relative: string | null | undefined): string | null => {
  if (!relative) return null;
  if (/^https?:\/\//.test(relative)) return relative;
  return `${env.ASSET_URL}${relative}`;
};
