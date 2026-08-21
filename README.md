# SuperBuyLuxe

Invitation-only B2B procurement platform for EU/US clients.

- **Private**: no public signup; accounts are created only with an invite code.
- **Products**: admin CRUD + CSV bulk import (price/stock sync by `sku`).
- **Image search**: CLIP visual embeddings stored in `pgvector`, cosine search.
- **Sourcing**: customers post a "find this" request (image + specs); admin replies with a quote / linked product.
- **Procurement loop**: cart → submit purchase order (pending quote) → admin quotes (pending payment) → customer pays offline → admin enters tracking number (completed).

## Stack

- Next.js 14 (App Router, TypeScript)
- Drizzle ORM + PostgreSQL with `pgvector`
- Custom JWT-cookie auth (jose + bcryptjs), invite-code gated
- CLIP image encoder via `@xenova/transformers` (runs on the server)
- Tailwind CSS

## Local development

```bash
cp .env.example .env
docker compose up -d            # starts Postgres + pgvector on :5432
npm install
npm run db:generate             # generate SQL migration from schema
npm run db:migrate              # create extension + tables
npm run seed                    # creates admin@superbuyluxe.com / admin12345 + a sample invite code
npm run dev                     # http://localhost:3000
```

A default admin is seeded: **admin@superbuyluxe.com / admin12345**.
Change it, then open `/admin/invite` to generate invite codes for clients.

## Deploy to superbuyluxe.com

### 1. Database (Neon, EU region — GDPR)
- Create a Neon project in **EU (Frankfurt)**.
- Copy the connection string into `DATABASE_URL`.
- `npm run db:migrate` creates the `vector` extension and all tables
  (run it once against Neon: `DATABASE_URL=<neon> npm run db:migrate`).

### 2. App (Vercel)
- Import this repo into Vercel.
- Set environment variables:
  - `DATABASE_URL` (Neon)
  - `JWT_SECRET` — `openssl rand -base64 48`
  - `APP_URL=https://superbuyluxe.com`
  - `RESEND_API_KEY` (optional; email stub logs if empty)
- Vercel auto-builds (`next build`). The `vercel.json` raises timeout for the
  image-encode / CSV-import functions (first CLIP run downloads the model).
- After the first deploy, run the migration once:
  `DATABASE_URL=<neon> npm run db:migrate`.

### 3. Domain + DNS (Cloudflare)
- **Recommendation**: put `superbuyluxe.com` in its **own Cloudflare account**
  so a problem with any other domain cannot suspend it (Cloudflare bans are
  account-level).
- Add the site in Cloudflare, then set DNS:
  - `www` → CNAME `cname.vercel-dns.com`
  - apex (`superbuyluxe.com`) → CNAME `cname.vercel-dns.com` (Cloudflare flattens CNAME)
- Orange-cloud (proxy) the records; SSL/TLS → Full (strict); Auto HTTPS on.
- Once live, update `APP_URL` to `https://superbuyluxe.com` and redeploy.

### 4. Email (optional, for EU/US clients)
- Resend: add `superbuyluxe.com`, verify SPF/DKIM/DMARC, set `RESEND_API_KEY`
  and `FROM_EMAIL`. Invite codes can then be emailed directly from `/admin/invite`.

## Notes
- Prices default to `EUR`; change per product or set `currency` in the CSV.
- Image search needs at least one product image embedded (happens on product
  create / CSV import). The first image encode downloads the CLIP model (~80MB)
  and may take a few seconds.
- Object storage (R2) is optional; the MVP stores image **URLs**.
