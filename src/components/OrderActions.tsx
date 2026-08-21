"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrderActions({ orderId, currency }: { orderId: string; currency: string }) {
  const router = useRouter();
  const [quoteTotal, setQuoteTotal] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [msg, setMsg] = useState("");

  async function quote() {
    setMsg("Saving quote…");
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quote", quoteTotal: Number(quoteTotal) }),
    });
    if (res.ok) {
      setMsg("Quoted — customer can now pay");
      router.refresh();
    } else setMsg("Failed");
  }

  async function ship() {
    setMsg("Saving tracking…");
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ship", trackingNo }),
    });
    if (res.ok) {
      setMsg("Shipped — tracking sent to customer");
      router.refresh();
    } else setMsg("Failed");
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          type="number"
          step="0.01"
          placeholder={`Quote total (${currency})`}
          value={quoteTotal}
          onChange={(e) => setQuoteTotal(e.target.value)}
        />
        <button className="btn btn-primary" onClick={quote}>
          Set quote
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Tracking number"
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
        />
        <button className="btn btn-ghost" onClick={ship}>
          Mark shipped
        </button>
      </div>
      {msg && <p style={{ fontSize: 13, margin: 0 }}>{msg}</p>}
    </div>
  );
}
