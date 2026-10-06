import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";

const completionUploadsDirectory = resolve(import.meta.dirname, "../../uploads/completions");
mkdirSync(completionUploadsDirectory, { recursive: true });

const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: completionUploadsDirectory,
  filename: (request, file, callback) => {
    const extension = extensionsByMimeType[file.mimetype] || extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    if (Object.hasOwn(extensionsByMimeType, file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Upload a JPG, PNG, or WebP image."));
  },
});

export function uploadCompletionPhoto(request, response, next) {
  upload.single("photo")(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The completion photo must be 5 MB or smaller."
      : error.message || "Could not upload the completion photo.";

    response.status(400).json({ success: false, message });
  });
}
