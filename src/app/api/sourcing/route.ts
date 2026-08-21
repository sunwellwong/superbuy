import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sourcingRequests, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows =
    user.role === "admin"
      ? await db
          .select({
            id: sourcingRequests.id,
            userId: sourcingRequests.userId,
            email: users.email,
            description: sourcingRequests.description,
            specs: sourcingRequests.specs,
            qty: sourcingRequests.qty,
            imageUrl: sourcingRequests.imageUrl,
            status: sourcingRequests.status,
            adminReply: sourcingRequests.adminReply,
            linkedProductId: sourcingRequests.linkedProductId,
            createdAt: sourcingRequests.createdAt,
          })
          .from(sourcingRequests)
          .innerJoin(users, eq(sourcingRequests.userId, users.id))
          .orderBy(desc(sourcingRequests.createdAt))
      : await db
          .select()
          .from(sourcingRequests)
          .where(eq(sourcingRequests.userId, user.id))
          .orderBy(desc(sourcingRequests.createdAt));

  return NextResponse.json({ requests: rows });
}

const createSchema = z.object({
  description: z.string().min(1),
  specs: z.string().optional(),
  qty: z.number().int().optional(),
  imageUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { description, specs, qty, imageUrl } = parsed.data;

  const [request] = await db
    .insert(sourcingRequests)
    .values({
      userId: user.id,
      description,
      specs: specs ?? null,
      qty: qty ?? null,
      imageUrl: imageUrl ?? null,
      status: "open",
    })
    .returning();

  return NextResponse.json({ request });
}
