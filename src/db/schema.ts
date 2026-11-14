import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type UserRole =
  | "customer"
  | "administrator"
  | "inventory_manager"
  | "order_manager"
  | "swap_assessor"
  | "content_editor";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").$type<UserRole>().notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  notificationPrefs: jsonb("notification_prefs")
    .$type<{
      orders: boolean;
      swaps: boolean;
      learn: boolean;
      promotions: boolean;
    }>()
    .notNull()
    .default({ orders: true, swaps: true, learn: true, promotions: false }),
  preferredBrands: jsonb("preferred_brands").$type<string[]>().notNull().default([]),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  district: text("district").notNull(),
  area: text("area").notNull(),
  streetDetails: text("street_details").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandId: integer("brand_id")
    .references(() => brands.id)
    .notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id)
    .notNull(),
  model: text("model").notNull(),
  condition: text("condition").notNull(), // 'new' | 'refurbished' | 'used'
  conditionGrade: text("condition_grade").notNull().default("Brand New Sealed"),
  batteryHealth: integer("battery_health"), // nullable; verified % for used/refurbished iPhones/phones
  networkCompatibility: text("network_compatibility").notNull().default("5G / 4G LTE · Unlocked Dual/eSIM"),
  warrantyMonths: integer("warranty_months").notNull().default(12),
  warrantyTerms: text("warranty_terms").notNull().default("12-month Century Gadgets verified hardware warranty"),
  description: text("description").notNull(),
  specs: jsonb("specs")
    .$type<{
      display: string;
      processor: string;
      ram: string;
      camera: string;
      battery: string;
      sim: string;
      os: string;
    }>()
    .notNull(),
  basePriceUgx: integer("base_price_ugx").notNull(),
  compareAtPriceUgx: integer("compare_at_price_ugx"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  isSwapEligible: boolean("is_swap_eligible").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  isSampleData: boolean("is_sample_data").notNull().default(true),
  popularityScore: integer("popularity_score").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  sku: text("sku").notNull().unique(),
  storage: text("storage").notNull(),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull().default("#102747"),
  priceUgx: integer("price_ugx").notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  reservedQty: integer("reserved_qty").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  deltaQty: integer("delta_qty").notNull(),
  previousQty: integer("previous_qty").notNull(),
  newQty: integer("new_qty").notNull(),
  reason: text("reason").notNull(),
  referenceType: text("reference_type").notNull(), // 'order' | 'manual_adjustment' | 'refund_restock' | 'seed'
  referenceId: text("reference_id"),
  actorUserId: integer("actor_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wishlists = pgTable(
  "wishlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    productId: integer("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("wishlists_user_product_idx").on(table.userId, table.productId)]
);

export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  sessionKey: text("session_key").unique(),
  discountCode: text("discount_code"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id")
      .references(() => carts.id, { onDelete: "cascade" })
      .notNull(),
    variantId: integer("variant_id")
      .references(() => productVariants.id, { onDelete: "cascade" })
      .notNull(),
    quantity: integer("quantity").notNull().default(1),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("cart_items_cart_variant_idx").on(table.cartId, table.variantId)]
);

export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed_ugx'
  value: integer("value").notNull(),
  minOrderUgx: integer("min_order_ugx").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  feeUgx: integer("fee_ugx").notNull(),
  estimatedTime: text("estimated_time").notNull(),
  instructions: text("instructions").notNull().default(""),
  isStoreCollection: boolean("is_store_collection").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderRef: text("order_ref").notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  status: text("status").notNull().default("pending_payment"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull(), // 'mtn_momo' | 'airtel_money' | 'card' | 'cash_on_collection'
  subtotalUgx: integer("subtotal_ugx").notNull(),
  discountUgx: integer("discount_ugx").notNull().default(0),
  deliveryFeeUgx: integer("delivery_fee_ugx").notNull().default(0),
  totalUgx: integer("total_ugx").notNull(),
  discountCode: text("discount_code"),
  deliveryZoneId: integer("delivery_zone_id").references(() => deliveryZones.id),
  collectionOption: text("collection_option").notNull(), // 'delivery' | 'store_pickup'
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNotes: text("delivery_notes").notNull().default(""),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  variantId: integer("variant_id")
    .references(() => productVariants.id)
    .notNull(),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  variantSnapshot: text("variant_snapshot").notNull(),
  unitPriceUgx: integer("unit_price_ugx").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalUgx: integer("line_total_ugx").notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  swapRequestId: integer("swap_request_id"),
  provider: text("provider").notNull(), // 'mtn_momo_sandbox' | 'airtel_money_sandbox' | 'flutterwave_sandbox' | 'cash_on_collection'
  providerRef: text("provider_ref").notNull().unique(),
  amountUgx: integer("amount_ugx").notNull(),
  currency: text("currency").notNull().default("UGX"),
  status: text("status").notNull().default("pending"), // 'pending' | 'successful' | 'failed' | 'refunded' | 'cancelled'
  isSimulated: boolean("is_simulated").notNull().default(true),
  payerPhoneMasked: text("payer_phone_masked"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  rawWebhookPayload: jsonb("raw_webhook_payload"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  paymentId: integer("payment_id")
    .references(() => payments.id)
    .notNull(),
  amountUgx: integer("amount_ugx").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'processed'
  requestedByUserId: integer("requested_by_user_id").references(() => users.id),
  approvedByUserId: integer("approved_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  swapRef: text("swap_ref").notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  targetProductId: integer("target_product_id")
    .references(() => products.id)
    .notNull(),
  targetVariantId: integer("target_variant_id")
    .references(() => productVariants.id)
    .notNull(),
  currentBrand: text("current_brand").notNull(),
  currentModel: text("current_model").notNull(),
  currentStorage: text("current_storage").notNull(),
  currentColor: text("current_color").notNull(),
  physicalCondition: text("physical_condition").notNull(),
  batteryCondition: text("battery_condition").notNull(),
  screenCondition: text("screen_condition").notNull(),
  cameraCondition: text("camera_condition").notNull(),
  powersOn: boolean("powers_on").notNull(),
  hasBeenRepaired: boolean("has_been_repaired").notNull(),
  includesBoxOrAccessories: text("includes_box_or_accessories").notNull(),
  ownershipDeclared: boolean("ownership_declared").notNull().default(true),
  status: text("status").notNull().default("submitted"),
  provisionalEstimateUgx: integer("provisional_estimate_ugx").notNull(),
  offeredValuationUgx: integer("offered_valuation_ugx"),
  finalConfirmedValuationUgx: integer("final_confirmed_valuation_ugx"),
  targetPriceUgx: integer("target_price_ugx").notNull(),
  payableDifferenceUgx: integer("payable_difference_ugx").notNull(),
  staffNotes: text("staff_notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const swapPhotos = pgTable("swap_photos", {
  id: serial("id").primaryKey(),
  swapRequestId: integer("swap_request_id")
    .references(() => swapRequests.id, { onDelete: "cascade" })
    .notNull(),
  angleLabel: text("angle_label").notNull(), // 'front' | 'back' | 'sides' | 'screen_on'
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const swapValuations = pgTable("swap_valuations", {
  id: serial("id").primaryKey(),
  swapRequestId: integer("swap_request_id")
    .references(() => swapRequests.id, { onDelete: "cascade" })
    .notNull(),
  stage: text("stage").notNull(), // 'provisional' | 'initial_offer' | 'post_inspection_revised' | 'final_confirmed'
  amountUgx: integer("amount_ugx").notNull(),
  payableDifferenceUgx: integer("payable_difference_ugx").notNull(),
  notes: text("notes").notNull().default(""),
  actorUserId: integer("actor_user_id").references(() => users.id),
  customerDecision: text("customer_decision"), // 'pending' | 'accepted' | 'declined'
  customerDecisionAt: timestamp("customer_decision_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const swapStatusHistory = pgTable("swap_status_history", {
  id: serial("id").primaryKey(),
  swapRequestId: integer("swap_request_id")
    .references(() => swapRequests.id, { onDelete: "cascade" })
    .notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note").notNull().default(""),
  actorUserId: integer("actor_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inspectionAppointments = pgTable("inspection_appointments", {
  id: serial("id").primaryKey(),
  swapRequestId: integer("swap_request_id")
    .references(() => swapRequests.id, { onDelete: "cascade" })
    .notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  locationType: text("location_type").notNull(), // 'store_dropoff' | 'scheduled_inspection'
  locationDetails: text("location_details").notNull(),
  status: text("status").notNull().default("scheduled"), // 'scheduled' | 'completed' | 'rescheduled' | 'cancelled'
  inspectorUserId: integer("inspector_user_id").references(() => users.id),
  inspectionNotes: text("inspection_notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const swapMessages = pgTable("swap_messages", {
  id: serial("id").primaryKey(),
  swapRequestId: integer("swap_request_id")
    .references(() => swapRequests.id, { onDelete: "cascade" })
    .notNull(),
  senderUserId: integer("sender_user_id")
    .references(() => users.id)
    .notNull(),
  senderRole: text("sender_role").notNull(), // 'customer' | 'staff'
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  coverImageUrl: text("cover_image_url").notNull(),
  authorName: text("author_name").notNull(),
  readingTimeMin: integer("reading_time_min").notNull().default(4),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  relatedProductIds: jsonb("related_product_ids").$type<number[]>().notNull().default([]),
  relatedVideoIds: jsonb("related_video_ids").$type<number[]>().notNull().default([]),
  quizQuestions: jsonb("quiz_questions")
    .$type<Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>>()
    .notNull()
    .default([]),
  isPublished: boolean("is_published").notNull().default(true),
  isSampleData: boolean("is_sample_data").notNull().default(true),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const articleBookmarks = pgTable(
  "article_bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    articleId: integer("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("article_bookmarks_user_article_idx").on(table.userId, table.articleId)]
);

export const tiktokVideos = pgTable("tiktok_videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  videoUrl: text("video_url").notNull(),
  embedUrl: text("embed_url"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  category: text("category").notNull(),
  linkedProductIds: jsonb("linked_product_ids").$type<number[]>().notNull().default([]),
  linkedArticleIds: jsonb("linked_article_ids").$type<number[]>().notNull().default([]),
  displayOrder: integer("display_order").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(true),
  isAvailable: boolean("is_available").notNull().default(true),
  isSampleData: boolean("is_sample_data").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(), // 'order' | 'payment' | 'swap' | 'learn' | 'promotion'
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'resolved'
  staffResponse: text("staff_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  actorEmail: text("actor_email").notNull().default("system"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  deliveryZone: one(deliveryZones, { fields: [orders.deliveryZoneId], references: [deliveryZones.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const swapRequestsRelations = relations(swapRequests, ({ one, many }) => ({
  user: one(users, { fields: [swapRequests.userId], references: [users.id] }),
  targetProduct: one(products, { fields: [swapRequests.targetProductId], references: [products.id] }),
  targetVariant: one(productVariants, { fields: [swapRequests.targetVariantId], references: [productVariants.id] }),
  photos: many(swapPhotos),
  valuations: many(swapValuations),
  statusHistory: many(swapStatusHistory),
  appointments: many(inspectionAppointments),
  messages: many(swapMessages),
}));
