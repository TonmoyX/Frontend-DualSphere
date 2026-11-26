"use client";

import { post } from "./api";

interface Presign {
  mediaId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  publicUrl: string;
  storage: "r2" | "local";
}

export interface UploadedMedia {
  id: string;
  url: string;
  kind: "image" | "video" | "audio";
  mime: string;
}

/**
 * Privacy: re-encode JPEG/PNG/WebP through a canvas before upload. This strips EXIF
 * metadata (GPS location, device serials) that could de-anonymise an anonymous poster.
 * GIFs/AVIF/videos are uploaded as-is.
 */
async function stripMetadata(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2560;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg"), { type });
  } catch {
    return file;
  }
}

/** Direct-to-storage upload: presign → PUT (Cloudflare R2 or local) → confirm. */
export async function uploadMedia(
  input: File,
  purpose: "post" | "avatar" | "cover" | "message" | "story" | "community" | "ad" | "group" = "post",
  onProgress?: (pct: number) => void,
): Promise<UploadedMedia> {
  const stripped = await stripMetadata(input);
  // MediaRecorder types look like "audio/webm;codecs=opus" — the server wants the bare type
  const bare = stripped.type.split(";")[0];
  const file = bare === stripped.type ? stripped : new File([stripped], stripped.name, { type: bare });
  const p = await post<Presign>("/media/presign", { filename: file.name, contentType: file.type, size: file.size, purpose });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", p.uploadUrl);
    Object.entries(p.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(uploadError(xhr))));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection (or R2 CORS settings)"));
    xhr.send(file);
  });

  const { media } = await post<{ media: UploadedMedia }>(`/media/${p.mediaId}/complete`);
  return media;
}

function uploadError(xhr: XMLHttpRequest) {
  try {
    return JSON.parse(xhr.responseText)?.error?.message ?? `Upload failed (${xhr.status})`;
  } catch {
    return `Upload failed (${xhr.status})`;
  }
}
