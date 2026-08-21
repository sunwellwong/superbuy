"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 380 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Sign in</h1>
      <label className="label">Email</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label className="label" style={{ marginTop: 12 }}>Password</label>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} disabled={loading}>
        {loading ? "…" : "Sign in"}
      </button>
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 12 }}>
        No account? <a href="/register" style={{ color: "#4f46e5" }}>Register with an invite code</a>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 380 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Register (invitation only)</h1>
      <label className="label">Name</label>
      <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
      <label className="label" style={{ marginTop: 12 }}>Email</label>
      <input className="input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
      <label className="label" style={{ marginTop: 12 }}>Password (min 6)</label>
      <input className="input" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
      <label className="label" style={{ marginTop: 12 }}>Invite code</label>
      <input className="input" value={form.inviteCode} onChange={(e) => update("inviteCode", e.target.value.toUpperCase())} required />
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} disabled={loading}>
        {loading ? "…" : "Create account"}
      </button>
    </form>
  );
}
