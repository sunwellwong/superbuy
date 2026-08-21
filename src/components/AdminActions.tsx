"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteGen() {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [email, setEmail] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Generating…");
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, email: email || undefined }),
    });
    const d = await res.json();
    if (res.ok) {
      setCodes(d.codes);
      setMsg(email ? "Generated and emailed" : "Generated");
      router.refresh();
    } else {
      setMsg(d.error ?? "Failed");
    }
  }

  return (
    <form onSubmit={generate} className="card" style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      <h3 style={{ margin: 0 }}>Generate invite codes</h3>
      <label className="label">How many?</label>
      <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
      <label className="label">Email (optional — sends code via Resend)</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" />
      <button className="btn btn-primary">Generate</button>
      {msg && <p style={{ fontSize: 13, margin: 0 }}>{msg}</p>}
      {codes.length > 0 && (
        <div style={{ fontSize: 13 }}>
          {codes.map((c) => (
            <code key={c} style={{ display: "block", background: "#f3f4f6", padding: "4px 8px", borderRadius: 6, marginBottom: 4 }}>
              {c}
            </code>
          ))}
        </div>
      )}
    </form>
  );
}
