"use client";

import { useState } from "react";
import { getClipEmbedding } from "@/lib/embed-client";

function urlToDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(b);
        })
    );
}

export default function SearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setMsg("Loading CLIP model & computing similarity…");
    setResults([]);

    let input: File | string | null = file;
    if (!file && url.trim()) {
      try {
        input = await urlToDataUrl(url.trim());
      } catch {
        setMsg("Could not load that image URL (cross-origin blocked)");
        setLoading(false);
        return;
      }
    }
    if (!input) {
      setMsg("Provide an image (upload or URL)");
      setLoading(false);
      return;
    }

    try {
      const vector = await getClipEmbedding(input);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vector }),
      });
      const d = await res.json();
      setLoading(false);
      if (!res.ok) {
        setMsg(d.error ?? "Search failed");
        return;
      }
      setResults(d.results);
      setMsg(d.results.length ? "" : "No similar products yet — add products with images first");
    } catch {
      setLoading(false);
      setMsg("Could not load the image model. Check your connection and retry.");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Image Search</h1>
      <div className="card" style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <label className="label">Upload an image</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label className="label">…or paste an image URL</label>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
        {msg && <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{msg}</p>}
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          CLIP visual embeddings run in your browser; pgvector cosine search on the server. First search downloads the model.
        </p>
      </div>

      {results.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          {results.map((r) => (
            <a key={r.id} href={`/products/${r.id}`} className="card" style={{ display: "block" }}>
              <div
                style={{
                  height: 130,
                  background: "#f3f4f6",
                  borderRadius: 8,
                  marginBottom: 8,
                  backgroundImage: r.image ? `url(${r.image})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ fontWeight: 500 }}>{r.name}</div>
              <div style={{ color: "#4f46e5", fontWeight: 600 }}>
                {Number(r.price).toFixed(2)} {r.currency}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>match {r.score.toFixed(3)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
