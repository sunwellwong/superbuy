import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  vector,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "customer"]);
export const productStatusEnum = pgEnum("product_status", ["active", "hidden"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending_quote",
  "pending_payment",
  "pending_shipment",
  "completed",
  "cancelled",
]);
export const sourcingStatusEnum = pgEnum("sourcing_status", [
  "open",
  "quoted",
  "converted",
  "closed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("customer"),
  inviteAccepted: boolean("invite_accepted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inviteCodes = pgTable("invite_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  role: roleEnum("role").notNull().default("customer"),
  createdBy: uuid("created_by"),
  usedBy: uuid("used_by"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: varchar("sku", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 8 }).notNull().default("EUR"),
  stock: integer("stock").notNull().default(0),
  categoryId: uuid("category_id"),
  status: productStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    embedding: vector("embedding", { dimensions: 512 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    productIdx: uniqueIndex("product_images_product_idx").on(t.productId),
  })
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userProductIdx: uniqueIndex("cart_user_product_idx").on(t.userId, t.productId),
  })
);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending_quote"),
  quoteTotal: numeric("quote_total", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 8 }).notNull().default("EUR"),
  trackingNo: text("tracking_no"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  qty: integer("qty").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const sourcingRequests = pgTable("sourcing_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  specs: text("specs"),
  qty: integer("qty"),
  imageUrl: text("image_url"),
  status: sourcingStatusEnum("status").notNull().default("open"),
  adminReply: text("admin_reply"),
  linkedProductId: uuid("linked_product_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type SourcingRequest = typeof sourcingRequests.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
