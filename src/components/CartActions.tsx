"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CartActions({
  items,
}: {
  items: {
    id: string;
    qty: number;
    product: {
      id: string;
      name: string;
      price: number;
      currency: string;
      image: string | null;
    };
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(productId: string) {
    setBusy(true);
    await fetch(`/api/cart?productId=${productId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function submitOrder() {
    setBusy(true);
    const res = await fetch("/api/orders", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.push("/orders");
      router.refresh();
    } else {
      alert("Could not submit order");
    }
  }

  const total = items.reduce((s, i) => s + i.qty * i.product.price, 0);
  const currency = items[0]?.product.currency ?? "EUR";

  if (items.length === 0) {
    return <p style={{ color: "#6b7280" }}>Your cart is empty.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((i) => (
        <div key={i.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "#f3f4f6",
              borderRadius: 8,
              backgroundImage: i.product.image ? `url(${i.product.image})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{i.product.name}</div>
            <div style={{ fontSize: 13, color: "#4f46e5" }}>
              {i.product.price.toFixed(2)} {i.product.currency} × {i.qty}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => remove(i.product.id)} disabled={busy}>
            Remove
          </button>
        </div>
      ))}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>
          Total: {total.toFixed(2)} {currency}
        </strong>
        <button className="btn btn-primary" onClick={submitOrder} disabled={busy}>
          Submit purchase order
        </button>
      </div>
    </div>
  );
}
