// CLIP image embedding that runs in the BROWSER (WASM backend).
// The server never loads the model — this keeps image search compatible with
// Cloudflare Pages (Workers runtime has no native addons and tight CPU limits).
// Imported lazily so it is never bundled into server-side rendering.
let extractor: any = null;

export async function getClipEmbedding(input: string | Blob): Promise<number[]> {
  if (!extractor) {
    const mod: any = await import("@xenova/transformers");
    extractor = await mod.pipeline(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32"
    );
  }
  const output: any = await extractor(input, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// Convert a File (image) into a base64 data URL for storage / embedding.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
