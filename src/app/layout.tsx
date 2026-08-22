import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";

export const metadata = {
  title: "SuperBuyLuxe — Private B2B Sourcing",
  description: "Invitation-only procurement, image search and reverse sourcing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container" style={{ paddingTop: 24, paddingBottom: 56 }}>
          {children}
        </main>
        <FloatingWhatsApp />
      </body>
    </html>
  );
}
