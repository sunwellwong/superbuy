import "dotenv/config";
import { db } from "../src/lib/db";
import { users, inviteCodes } from "../src/lib/schema";
import { hashPassword } from "../src/lib/auth";
import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";

const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@superbuyluxe.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (!existing) {
    await db.insert(users).values({
      email: adminEmail,
      name: "Admin",
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      inviteAccepted: true,
    });
    console.log(`Created admin: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("Admin already exists.");
  }

  const code = process.env.SEED_INVITE_CODE ?? gen();
  const [existingCode] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!existingCode) {
    await db.insert(inviteCodes).values({ code, role: "customer" });
    console.log(`Created invite code: ${code}`);
  } else {
    console.log("Invite code already exists:", code);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
