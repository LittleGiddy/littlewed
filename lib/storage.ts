// lib/storage.ts
// All image uploads go through Cloudinary (never Vercel Blob).
import cloudinary from './cloudinary';

function sanitizePublicId(name: string): string {
  return String(name).replace(/[^a-zA-Z0-9_\-.]/g, '-').slice(0, 120);
}

export async function uploadToCloudinary(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const segments = String(key).split('/').filter(Boolean);

  // Last segment is the filename; the rest is the folder path.
  const fileName = segments.pop() || `upload-${Date.now()}.png`;
  const folder = segments.join('/');
  const publicId = sanitizePublicId(fileName.replace(/\.[^.]+$/, ''));

  const options: Record<string, unknown> = {
    folder,
    public_id: publicId,
    overwrite: true,
    unique_filename: false,
    resource_type: 'image',
  };

  if (contentType === 'application/pdf' || contentType === 'application/octet-stream') {
    options.resource_type = 'raw';
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        console.error('[Cloudinary] Upload error:', error);
        reject(error);
      } else if (!result?.secure_url) {
        const err = new Error(`[Cloudinary] Upload returned no secure_url for ${key}`);
        console.error(err.message);
        reject(err);
      } else {
        resolve(result.secure_url);
      }
    });
    uploadStream.end(buffer);
  });
}

// Kept for backward compatibility with existing call sites that referenced
// the old Vercel Blob helper. Now backed by Cloudinary.
export const uploadToBlob = uploadToCloudinary;