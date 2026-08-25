export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const validateImageUpload = (file) => {
  if (!(file instanceof File)) return "Select an image file.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, WebP, HEIC, or HEIF image.";
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "Image size must be 8 MB or less.";
  }
  return "";
};
