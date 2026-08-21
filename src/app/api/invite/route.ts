export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inviteCodes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { customAlphabet } from "nanoid";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const codes = await db
    .select()
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt))
    .limit(200);
  return NextResponse.json({ codes });
}

const createSchema = z.object({
  count: z.number().int().min(1).max(50).default(1),
  role: z.enum(["admin", "customer"]).default("customer"),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { count, role, email } = parsed.data;

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = gen();
    await db.insert(inviteCodes).values({ code, role, createdBy: user.id }).returning();
    codes.push(code);
  }

  if (email) {
    const link = `${process.env.APP_URL ?? "https://superbuyluxe.com"}/register`;
    await sendEmail(
      email,
      "Your SuperBuyLuxe invite",
      `You are invited to SuperBuyLuxe.\n\nInvite code: ${codes[0]}\nRegister here: ${link}`
    );
  }

  return NextResponse.json({ codes });
}
