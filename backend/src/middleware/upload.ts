import multer from "multer";

const FIVE_MB = 5 * 1024 * 1024;

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (ALLOWED_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  // Reject without throwing — the route validates `req.files` after parsing
  // and returns a normal validation error envelope.
  cb(null, false);
};

const baseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FIVE_MB, files: 5 },
  fileFilter,
});

export const uploadProductImages = baseUpload.array("images", 5);
export const uploadLogo = baseUpload.single("logo");
