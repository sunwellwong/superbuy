import { db } from "@/lib/db";
import { cartItems, products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { CartActions } from "@/components/CartActions";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select({
      id: cartItems.id,
      qty: cartItems.qty,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        currency: products.currency,
        image: productImages.url,
      },
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(cartItems.userId, user.id));

  const items = rows.map((i) => ({
    id: i.id,
    qty: i.qty,
    product: { ...i.product, price: Number(i.product.price) },
  }));

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Cart</h1>
      <CartActions items={items} />
    </div>
  );
}
