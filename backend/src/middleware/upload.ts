import multer from "multer";

const FIVE_MB = 5 * 1024 * 1024;

// We deliberately accept any image/* MIME plus application/octet-stream:
// browsers + curl differ on what they send for .webp (some send
// application/octet-stream when the OS mime db lacks an entry), and MIME
// is spoofable anyway. The Sharp metadata check in utils/images.ts is the
// real gate — it rejects anything that isn't actually JPEG/PNG/WebP.
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/octet-stream"
  ) {
    cb(null, true);
    return;
  }
  cb(null, false);
};

const baseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FIVE_MB, files: 5 },
  fileFilter,
});

export const uploadProductImages = baseUpload.array("images", 5);
export const uploadLogo = baseUpload.single("logo");
