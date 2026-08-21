import { pipeline } from "@xenova/transformers";

// CLIP image encoder. Model is downloaded on first use and cached.
// Input can be an image URL or a base64 data URL. Output is a 512-dim
// L2-normalized vector suitable for pgvector cosine distance (`<=>`).
let extractor: any = null;

export async function getImageEmbedding(input: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32"
    );
  }
  const output: any = await extractor(input, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}
