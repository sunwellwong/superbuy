import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sourcingRequests, products } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  adminReply: z.string().optional(),
  linkedProductId: z.string().optional(),
  status: z.enum(["open", "quoted", "converted", "closed"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { adminReply, linkedProductId, status } = parsed.data;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (adminReply !== undefined) set.adminReply = adminReply;
  if (linkedProductId !== undefined) set.linkedProductId = linkedProductId;
  if (status !== undefined) set.status = status;

  if (linkedProductId) {
    const [p] = await db
      .select()
      .from(products)
      .where(eq(products.id, linkedProductId))
      .limit(1);
    if (!p) return NextResponse.json({ error: "Linked product not found" }, { status: 400 });
  }

  await db.update(sourcingRequests).set(set).where(eq(sourcingRequests.id, params.id));
  return NextResponse.json({ ok: true });
}
