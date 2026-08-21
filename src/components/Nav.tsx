import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function Nav() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  return (
    <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", height: 56, gap: 18 }}
      >
        <Link href="/" style={{ fontWeight: 700, color: "#4338ca", fontSize: 16 }}>
          SuperBuyLuxe
        </Link>
        <nav style={{ display: "flex", gap: 14, flex: 1, fontSize: 14 }}>
          <Link href="/products">Products</Link>
          <Link href="/search">Image Search</Link>
          <Link href="/sourcing">Sourcing</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/orders">Orders</Link>
          {isAdmin && (
            <Link href="/admin" style={{ color: "#9333ea", fontWeight: 600 }}>
              Admin
            </Link>
          )}
        </nav>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{user.name}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Login
              </Link>
              <Link href="/register" className="btn btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
