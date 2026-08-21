import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/superbuyluxe";

// Neon serverless driver over HTTP/websocket — works on Cloudflare Pages (Workers runtime)
// without a long-lived TCP connection. Stateless, so no pool config needed.
const sql = neon(url);

export const db = drizzle(sql, { schema });
export { sql };
