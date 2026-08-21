"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NameSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/products?q=${encodeURIComponent(q)}`);
      }}
      style={{ display: "flex", gap: 8, maxWidth: 420 }}
    >
      <input
        className="input"
        placeholder="Search products by name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn btn-ghost" type="submit">
        Search
      </button>
    </form>
  );
}
