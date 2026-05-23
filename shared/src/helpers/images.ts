/**
 * Derive the thumbnail URL from a stored full-size image URL.
 * Convention: insert `-thumb` before the extension.
 *   /uploads/products/abc.webp -> /uploads/products/abc-thumb.webp
 *
 * Keeping this in shared lets the frontend render thumbnails directly
 * from a ProductImage payload without a second DB column.
 */
export const thumbUrl = (url: string): string => {
  const lastDot = url.lastIndexOf(".");
  if (lastDot === -1) return `${url}-thumb`;
  return `${url.slice(0, lastDot)}-thumb${url.slice(lastDot)}`;
};
