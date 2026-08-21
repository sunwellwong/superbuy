import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, inviteCodes } from "@/lib/schema";
import { hashPassword, signSession, SESSION_COOKIE } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  inviteCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, name, password, inviteCode } = parsed.data;

  const [code] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, inviteCode.toUpperCase()))
    .limit(1);
  if (!code || code.usedBy) {
    return NextResponse.json({ error: "Invite code invalid or already used" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      name,
      passwordHash: await hashPassword(password),
      role: code.role,
      inviteAccepted: true,
    })
    .returning();

  await db.update(inviteCodes).set({ usedBy: user.id }).where(eq(inviteCodes.id, code.id));

  const token = await signSession({ sub: user.id, email: user.email, role: user.role });
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
