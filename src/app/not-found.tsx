export const runtime = "edge";

export default function NotFound() {
  return (
    <main style={{ padding: "4rem 1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>404</h1>
      <p style={{ color: "#555" }}>This page could not be found.</p>
      <a href="/" style={{ color: "#2563eb" }}>Back to home</a>
    </main>
  );
}
