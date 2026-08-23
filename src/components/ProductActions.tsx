"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getClipEmbedding, fileToDataUrl } from "@/lib/embed-client";

export function AddToCart({ productId }: { productId: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  async function add() {
    setMsg("");
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, qty }),
    });
    if (res.ok) {
      setMsg("Added to cart");
      router.refresh();
    } else {
      setMsg("Failed");
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        className="input"
        style={{ width: 70 }}
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
      />
      <button className="btn btn-primary" onClick={add}>
        Add to cart
      </button>
      {msg && <span style={{ fontSize: 13, color: "#16a34a" }}>{msg}</span>}
    </div>
  );
}

export function ProductForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    costCny: "",
    shippingCny: "150",
    profitCny: "150",
    currency: "EUR",
    stock: "0",
    imageUrl: "",
    description: "",
    category: "",
    brand: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setPreview(await fileToDataUrl(f));
    else setPreview("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    let imageUrl = form.imageUrl.trim();
    let embedding: number[] | null = null;
    if (file) {
      try {
        const dataUrl = await fileToDataUrl(file);
        imageUrl = dataUrl;
        setMsg("Computing image embedding…");
        embedding = await getClipEmbedding(file);
      } catch {
        setMsg("Image saved without embedding (model unavailable) — search may skip it");
      }
    }
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        costCny: form.costCny ? Number(form.costCny) : undefined,
        shippingCny: form.shippingCny ? Number(form.shippingCny) : undefined,
        profitCny: form.profitCny ? Number(form.profitCny) : undefined,
        stock: Number(form.stock),
        imageUrl: imageUrl || undefined,
        embedding: embedding ?? undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setMsg("Created");
      router.refresh();
    } else {
      const d = await res.json();
      setMsg(d.error ?? "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>New product</h3>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">SKU</label>
          <input className="input" value={form.sku} onChange={(e) => update("sku", e.target.value)} required />
        </div>
        <div style={{ flex: 2 }}>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">Cost (CNY)</label>
          <input className="input" type="number" step="0.01" value={form.costCny} onChange={(e) => update("costCny", e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">Shipping (CNY)</label>
          <input className="input" type="number" step="0.01" value={form.shippingCny} onChange={(e) => update("shippingCny", e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">Profit (CNY)</label>
          <input className="input" type="number" step="0.01" value={form.profitCny} onChange={(e) => update("profitCny", e.target.value)} required />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">Currency</label>
          <input className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">Stock</label>
          <input className="input" type="number" value={form.stock} onChange={(e) => update("stock", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">Category</label>
          <input className="input" value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="鞋靴 / 箱包 / 服装..." />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">Brand</label>
          <input className="input" value={form.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Hermès / Gucci..." />
        </div>
      </div>
      <label className="label">Image (upload — embedding computed in browser)</label>
      <input type="file" accept="image/*" onChange={onFile} />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="preview" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
      )}
      <label className="label">…or image URL</label>
      <input className="input" value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} placeholder="https://..." />
      <label className="label">Description</label>
      <textarea className="input" rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
      {msg && <p style={{ fontSize: 13, color: msg === "Created" ? "#16a34a" : "#dc2626", margin: 0 }}>{msg}</p>}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "…" : "Create"}
      </button>
    </form>
  );
}

export function CsvImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const text = await f.text();
      setCsv(text);
      setMsg(`已读取文件 ${f.name}（${text.split(/\r?\n/).length - 1} 行），点 Import 上传`);
    } catch {
      setMsg("读取文件失败，请重试");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!csv.trim()) {
      setMsg("请先选择 CSV 文件，或粘贴内容");
      return;
    }
    setMsg("Importing…");
    const res = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const d = await res.json();
    if (res.ok) {
      setMsg(`Imported ${d.imported} products`);
      setCsv("");
      setFileName("");
      router.refresh();
    } else {
      setMsg(d.error ?? "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Bulk import (CSV)</h3>
      <label className="label">Upload CSV file</label>
      <input type="file" accept=".csv,text/csv" onChange={onFile} />
      {fileName && <p style={{ fontSize: 12, color: "#16a34a", margin: 0 }}>已选: {fileName}</p>}
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
        Columns: sku, name, cost_cny, shipping_cny, profit_cny, currency, stock, description, image_url
      </p>
      <textarea
        className="input"
        rows={8}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"sku,name,cost_cny,shipping_cny,profit_cny,currency,stock,description,image_url\nsample-001,Gold Watch,520,150,150,EUR,10,Luxury watch,https://.../a.jpg"}
      />
      <button className="btn btn-primary">Import</button>
      {msg && <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{msg}</p>}
    </form>
  );
}
