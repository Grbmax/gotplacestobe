import { put } from "@vercel/blob";

/** Persist an image. Prefer Vercel Blob; otherwise keep the data URL. */
export async function persistImage(dataUrl: string, keyHint: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return dataUrl;

  try {
    const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) return dataUrl;
    const contentType = match[1]!;
    const buffer = Buffer.from(match[2]!, "base64");
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const blob = await put(`scans/${keyHint}.${ext}`, buffer, {
      access: "public",
      contentType,
      token,
    });
    return blob.url;
  } catch (err) {
    console.error("[blob] upload failed, keeping data URL", err);
    return dataUrl;
  }
}
