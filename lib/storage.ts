import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const BUCKET = 'bill-images';

// atob is available in the Hermes runtime (RN 0.74+); typed loosely to avoid
// depending on DOM lib types.
const decodeBase64 = (base64: string): Uint8Array => {
  const binary: string = (globalThis as any).atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** True if the URI already points at a remote (uploaded) image. */
export function isRemoteImage(uri: string | null | undefined): boolean {
  return !!uri && /^https?:\/\//.test(uri);
}

/**
 * Uploads a local image file to Supabase Storage and returns its public URL,
 * so meter photos sync across devices instead of being trapped on one phone.
 * Throws on failure — callers can fall back to keeping the local URI.
 */
export async function uploadBillImage(localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decodeBase64(base64);

  const isPng = localUri.toLowerCase().endsWith('.png');
  const ext = isPng ? 'png' : 'jpg';
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const path = `bills/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
