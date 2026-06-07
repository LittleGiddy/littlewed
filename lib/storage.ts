import { put } from '@vercel/blob';

export async function uploadToBlob(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const blob = await put(key, buffer, {
    access: 'public',
    contentType,
  });
  return blob.url;
}