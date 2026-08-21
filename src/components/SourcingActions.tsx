"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourcingForm() {
  const router = useRouter();
  const [form, setForm] = useState({ description: "", specs: "", qty: "", imageUrl: "" });
  const [msg, setMsg] = useState("");

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Submitting…");
    const res = await fetch("/api/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description,
        specs: form.specs || undefined,
        qty: form.qty ? Number(form.qty) : undefined,
        imageUrl: form.imageUrl || undefined,
      }),
    });
    if (res.ok) {
      setMsg("Request sent");
      setForm({ description: "", specs: "", qty: "", imageUrl: "" });
      router.refresh();
    } else {
      setMsg("Failed");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>New sourcing request</h3>
      <label className="label">What are you looking for?</label>
      <textarea className="input" rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} required />
      <label className="label">Specs (optional)</label>
      <input className="input" value={form.specs} onChange={(e) => update("specs", e.target.value)} placeholder="material, size, brand…" />
      <label className="label">Quantity (optional)</label>
      <input className="input" type="number" value={form.qty} onChange={(e) => update("qty", e.target.value)} />
      <label className="label">Reference image URL (optional)</label>
      <input className="input" value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} placeholder="https://…" />
      <button className="btn btn-primary">Submit request</button>
      {msg && <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{msg}</p>}
    </form>
  );
}

export function SourcingReply({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [adminReply, setAdminReply] = useState("");
  const [linkedProductId, setLinkedProductId] = useState("");
  const [status, setStatus] = useState("quoted");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Saving…");
    const res = await fetch(`/api/sourcing/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminReply: adminReply || undefined,
        linkedProductId: linkedProductId || undefined,
        status,
      }),
    });
    if (res.ok) {
      setMsg("Replied");
      router.refresh();
    } else {
      setMsg("Failed");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 8 }}>
      <label className="label">Reply to customer</label>
      <textarea className="input" rows={2} value={adminReply} onChange={(e) => setAdminReply(e.target.value)} />
      <label className="label">Link a product (optional)</label>
      <input className="input" value={linkedProductId} onChange={(e) => setLinkedProductId(e.target.value)} placeholder="product id" />
      <label className="label">Status</label>
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="quoted">Quoted</option>
        <option value="converted">Converted</option>
        <option value="closed">Closed</option>
      </select>
      <button className="btn btn-primary">Send reply</button>
      {msg && <p style={{ fontSize: 13, margin: 0 }}>{msg}</p>}
    </form>
  );
}
