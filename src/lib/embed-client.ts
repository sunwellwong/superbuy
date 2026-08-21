// CLIP image embedding that runs in the BROWSER (WASM backend).
// The server never loads the model — this keeps image search compatible with
// Cloudflare Pages (Workers runtime has no native addons and tight CPU limits).
//
// We load transformers.js at runtime from a CDN with `webpackIgnore` so webpack
// never tries to bundle the package (its Node built-ins like `node:stream/web`
// break the browser build). The model weights are still fetched from HuggingFace
// at runtime by transformers.js itself.
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm";
let extractor: any = null;

export async function getClipEmbedding(input: string | Blob): Promise<number[]> {
  if (!extractor) {
    const mod: any = await import(/* webpackIgnore: true */ TRANSFORMERS_CDN);
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
