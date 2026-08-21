import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/superbuyluxe";
const client = postgres(url, { prepare: false });

async function main() {
  // pgvector is required before any table with a vector column can be created
  await client.unsafe("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("Ensured pgvector extension.");

  const dir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(dir)) {
    console.log(
      "No drizzle/ SQL found. Run `npm run db:generate` first, then `npm run db:migrate`."
    );
    await client.end();
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log("Applying migration:", file);
    await client.unsafe(sql);
  }

  console.log("Migrations applied.");
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
