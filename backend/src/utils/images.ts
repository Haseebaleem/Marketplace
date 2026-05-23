import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { ValidationError } from "./errors";

export const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");
export const PRODUCTS_DIR = path.join(UPLOADS_ROOT, "products");
export const LOGOS_DIR = path.join(UPLOADS_ROOT, "logos");

export const ALLOWED_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

export const ensureDirs = async (): Promise<void> => {
  await fs.mkdir(PRODUCTS_DIR, { recursive: true });
  await fs.mkdir(LOGOS_DIR, { recursive: true });
};

interface ProcessOptions {
  buffer: Buffer;
  outputDir: string;
  maxWidth: number;
  generateThumbnail?: boolean;
  thumbnailWidth?: number;
}

interface ProcessResult {
  url: string;
  absPath: string;
  thumbUrl: string | null;
  thumbAbsPath: string | null;
}

const verifyImage = async (buffer: Buffer) => {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ValidationError("Uploaded file is not a valid image");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new ValidationError(
      `Unsupported image format${metadata.format ? `: ${metadata.format}` : ""}. Allowed: jpg, png, webp`,
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new ValidationError("Image dimensions could not be determined");
  }
  return metadata;
};

export const thumbPathFor = (url: string): string => {
  const ext = path.extname(url);
  const base = url.slice(0, url.length - ext.length);
  return `${base}-thumb${ext}`;
};

export const processImage = async ({
  buffer,
  outputDir,
  maxWidth,
  generateThumbnail = false,
  thumbnailWidth = 300,
}: ProcessOptions): Promise<ProcessResult> => {
  await verifyImage(buffer);

  const filename = `${randomUUID()}.webp`;
  const absPath = path.join(outputDir, filename);

  await sharp(buffer)
    .rotate() // honor EXIF orientation
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(absPath);

  const relative = path.relative(UPLOADS_ROOT, absPath).split(path.sep).join("/");
  const url = `/uploads/${relative}`;

  let thumbUrl: string | null = null;
  let thumbAbsPath: string | null = null;
  if (generateThumbnail) {
    thumbAbsPath = thumbPathFor(absPath);
    await sharp(buffer)
      .rotate()
      .resize({ width: thumbnailWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbAbsPath);
    thumbUrl = thumbPathFor(url);
  }

  return { url, absPath, thumbUrl, thumbAbsPath };
};

const safeUnlink = async (absPath: string) => {
  try {
    await fs.unlink(absPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
};

/**
 * Given a stored relative URL (e.g. "/uploads/products/abc.webp"), delete the
 * file from disk along with its -thumb variant if it exists. Errors other
 * than ENOENT propagate.
 */
export const deleteImageFiles = async (url: string): Promise<void> => {
  const cleaned = url.replace(/^\/uploads\//, "");
  // Defensive: refuse anything that would escape the uploads dir.
  const target = path.resolve(UPLOADS_ROOT, cleaned);
  if (!target.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error("Refused to delete file outside uploads directory");
  }
  await safeUnlink(target);
  await safeUnlink(thumbPathFor(target));
};
