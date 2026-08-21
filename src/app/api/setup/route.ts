import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, inviteCodes } from "@/lib/schema";
import { hashPassword } from "@/lib/auth";
import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";

// One-shot setup endpoint: creates the schema (pgvector) and seeds the admin
// user + a customer invite code. Runs on Cloudflare (good network) so it needs
// no local tooling. Protected by SETUP_KEY so it can't be abused.
const DDL: string[] = [
  "CREATE EXTENSION IF NOT EXISTS vector;",
  "CREATE TYPE role AS ENUM ('admin','customer');",
  "CREATE TYPE product_status AS ENUM ('active','hidden');",
  "CREATE TYPE order_status AS ENUM ('pending_quote','pending_payment','pending_shipment','completed','cancelled');",
  "CREATE TYPE sourcing_status AS ENUM ('open','quoted','converted','closed');",
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    password_hash text NOT NULL,
    role role NOT NULL DEFAULT 'customer',
    invite_accepted boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS invite_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(32) NOT NULL UNIQUE,
    role role NOT NULL DEFAULT 'customer',
    created_by uuid,
    used_by uuid,
    expires_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(120) NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku varchar(120) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    description text,
    price numeric(12,2) NOT NULL DEFAULT 0,
    currency varchar(8) NOT NULL DEFAULT 'EUR',
    stock integer NOT NULL DEFAULT 0,
    category_id uuid,
    status product_status NOT NULL DEFAULT 'active',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url text NOT NULL,
    embedding vector(512),
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (product_id)
  );`,
  `CREATE TABLE IF NOT EXISTS cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty integer NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
  );`,
  `CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status order_status NOT NULL DEFAULT 'pending_quote',
    quote_total numeric(12,2),
    currency varchar(8) NOT NULL DEFAULT 'EUR',
    tracking_no text,
    note text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    qty integer NOT NULL DEFAULT 1,
    unit_price numeric(12,2) NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS sourcing_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description text NOT NULL,
    specs text,
    qty integer,
    image_url text,
    status sourcing_status NOT NULL DEFAULT 'open',
    admin_reply text,
    linked_product_id uuid,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );`,
  "CREATE INDEX IF NOT EXISTS product_images_embedding_idx ON product_images USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);",
];

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-setup-key");
  if (!key || key !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: string[] = [];
  for (const stmt of DDL) {
    try {
      await db.execute(sql.raw(stmt));
      steps.push("OK: " + stmt.slice(0, 48));
    } catch (e: any) {
      // enum/table already exists is expected on re-runs
      steps.push("SKIP: " + stmt.slice(0, 48) + " (" + (e?.message ?? "").slice(0, 60) + ")");
    }
  }

  // Seed admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@superbuyluxe.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  if (!existingAdmin) {
    await db.insert(users).values({
      email: adminEmail,
      name: "Admin",
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      inviteAccepted: true,
    });
    steps.push(`Seeded admin ${adminEmail} / ${adminPassword}`);
  } else {
    steps.push("Admin already exists");
  }

  const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
  const code = process.env.SEED_INVITE_CODE ?? gen();
  const [existingCode] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);
  if (!existingCode) {
    await db.insert(inviteCodes).values({ code, role: "customer" });
    steps.push(`Seeded invite code ${code}`);
  } else {
    steps.push("Invite code already exists");
  }

  return NextResponse.json({ ok: true, steps });
}
