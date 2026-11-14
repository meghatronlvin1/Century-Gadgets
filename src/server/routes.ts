import crypto from "crypto";
import fs from "fs";
import path from "path";
import express, { Response } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  addresses,
  articleBookmarks,
  articles,
  auditLogs,
  brands,
  cartItems,
  carts,
  categories,
  deliveryZones,
  discountCodes,
  inspectionAppointments,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  payments,
  productImages,
  productVariants,
  products,
  refunds,
  reviews,
  storeSettings,
  supportTickets,
  swapMessages,
  swapPhotos,
  swapRequests,
  swapStatusHistory,
  swapValuations,
  tiktokVideos,
  users,
  wishlists,
  type UserRole,
} from "../db/schema.ts";
import {
  AuthRequest,
  STAFF_ROLES,
  hashPassword,
  mapDbUser,
  optionalAuth,
  requireAuth,
  requireRoles,
  signAppToken,
  verifyAppToken,
  verifyPassword,
} from "./auth.ts";
import {
  calculateCartTotals,
  calculateProvisionalSwapEstimate,
  calculateSwapDifference,
  isValidOrderTransition,
  isValidSwapTransition,
  signPaymentWebhookPayload,
  verifyPaymentWebhookSignature,
} from "./domain.ts";
import { openApiSpec } from "./openapi.ts";
import { ensureSeeded } from "./seed.ts";

export const apiRouter = express.Router();

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "century-gadgets-sandbox-webhook-secret";

function maskPhone(phone: string): string {
  if (phone.length < 6) return "***";
  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}

async function logAudit(params: {
  actorUserId?: number | null;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? "system",
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details ?? {},
  });
}

async function getOrCreateCart(userId?: number, sessionKey?: string) {
  if (userId) {
    const existing = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    if (existing.length > 0) return existing[0];

    // If there was a guest session cart, attach it to user
    if (sessionKey) {
      const guestCart = await db.select().from(carts).where(eq(carts.sessionKey, sessionKey)).limit(1);
      if (guestCart.length > 0 && !guestCart[0].userId) {
        const [claimed] = await db
          .update(carts)
          .set({ userId, sessionKey: null, updatedAt: new Date() })
          .where(eq(carts.id, guestCart[0].id))
          .returning();
        return claimed;
      }
    }

    const [created] = await db.insert(carts).values({ userId }).returning();
    return created;
  }

  const key = sessionKey || crypto.randomUUID();
  const existingGuest = await db.select().from(carts).where(eq(carts.sessionKey, key)).limit(1);
  if (existingGuest.length > 0) return existingGuest[0];
  const [createdGuest] = await db.insert(carts).values({ sessionKey: key }).returning();
  return createdGuest;
}

async function hydrateCart(cartRow: typeof carts.$inferSelect, deliveryZoneId?: number) {
  const rows = await db
    .select({
      cartItemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      sku: productVariants.sku,
      storage: productVariants.storage,
      color: productVariants.color,
      colorHex: productVariants.colorHex,
      priceUgx: productVariants.priceUgx,
      stockQty: productVariants.stockQty,
      reservedQty: productVariants.reservedQty,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      condition: products.condition,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(cartItems.cartId, cartRow.id));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const imageRows =
    productIds.length > 0
      ? await db
          .select()
          .from(productImages)
          .where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true)))
      : [];
  const imageByProduct = Object.fromEntries(imageRows.map((i) => [i.productId, i.url]));

  let discountObj = null;
  if (cartRow.discountCode) {
    const found = await db
      .select()
      .from(discountCodes)
      .where(and(eq(discountCodes.code, cartRow.discountCode), eq(discountCodes.isActive, true)))
      .limit(1);
    if (found.length > 0) {
      discountObj = found[0];
    }
  }

  let deliveryFeeUgx = 0;
  let selectedZone = null;
  if (deliveryZoneId) {
    const zones = await db
      .select()
      .from(deliveryZones)
      .where(and(eq(deliveryZones.id, deliveryZoneId), eq(deliveryZones.isActive, true)))
      .limit(1);
    if (zones.length > 0) {
      selectedZone = zones[0];
      deliveryFeeUgx = zones[0].feeUgx;
    }
  }

  const totals = calculateCartTotals(
    rows.map((r) => ({ unitPriceUgx: r.priceUgx, quantity: r.quantity })),
    discountObj,
    deliveryFeeUgx
  );

  return {
    id: cartRow.id,
    sessionKey: cartRow.sessionKey,
    items: rows.map((r) => ({
      ...r,
      availableQty: Math.max(0, r.stockQty - r.reservedQty),
      imageUrl: imageByProduct[r.productId] || "media:iphone",
      lineTotalUgx: r.priceUgx * r.quantity,
    })),
    itemCount: rows.reduce((s, r) => s + r.quantity, 0),
    selectedZone,
    ...totals,
  };
}

async function hydrateProducts(productRows: Array<typeof products.$inferSelect>) {
  if (productRows.length === 0) return [];
  const productIds = productRows.map((p) => p.id);
  const [brandRows, catRows, variantRows, imageRows, reviewRows] = await Promise.all([
    db.select().from(brands),
    db.select().from(categories),
    db.select().from(productVariants).where(inArray(productVariants.productId, productIds)),
    db.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.sortOrder)),
    db.select().from(reviews).where(and(inArray(reviews.productId, productIds), eq(reviews.isApproved, true))),
  ]);

  const brandMap = Object.fromEntries(brandRows.map((b) => [b.id, b]));
  const catMap = Object.fromEntries(catRows.map((c) => [c.id, c]));

  return productRows.map((p) => {
    const pVariants = variantRows.filter((v) => v.productId === p.id && v.isActive);
    const pImages = imageRows.filter((i) => i.productId === p.id);
    const pReviews = reviewRows.filter((r) => r.productId === p.id);
    const totalAvailableStock = pVariants.reduce((sum, v) => sum + Math.max(0, v.stockQty - v.reservedQty), 0);

    return {
      ...p,
      brand: brandMap[p.brandId] ?? null,
      category: catMap[p.categoryId] ?? null,
      variants: pVariants.map((v) => ({
        ...v,
        availableQty: Math.max(0, v.stockQty - v.reservedQty),
      })),
      images: pImages,
      primaryImageUrl: pImages.find((i) => i.isPrimary)?.url || pImages[0]?.url || "media:iphone",
      totalAvailableStock,
      reviewCount: pReviews.length,
      averageRating:
        pReviews.length > 0
          ? Number((pReviews.reduce((s, r) => s + r.rating, 0) / pReviews.length).toFixed(1))
          : null,
    };
  });
}

// Ensure seed ran once lazily for public endpoints
apiRouter.use(async (_req, _res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error("Database seed error:", err);
    next(err);
  }
});

// ==================== HEALTH & DOCS ====================
apiRouter.get("/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", service: "century-gadgets-api", version: "1.0.0" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "error", error: "Database unavailable" });
  }
});

apiRouter.get("/docs/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

// ==================== AUTH & ACCOUNTS ====================
const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8).max(128),
});

apiRouter.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid registration input", details: parsed.error.flatten() });
  }

  try {
    const emailLower = parsed.data.email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const uid = `local-${crypto.randomUUID()}`;
    const ownerEmail = (process.env.CENTURY_OWNER_EMAIL || "kiwalabyemarkalvin@gmail.com").toLowerCase();
    const role: UserRole = emailLower === ownerEmail ? "administrator" : "customer";

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email: emailLower,
        phone: parsed.data.phone?.trim() || null,
        fullName: parsed.data.fullName.trim(),
        passwordHash: hashPassword(parsed.data.password),
        role,
        emailVerified: false,
      })
      .returning();

    const accessToken = signAppToken(created.uid, created.email, "access");
    const refreshToken = signAppToken(created.uid, created.email, "refresh");

    res.status(201).json({
      user: mapDbUser(created),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Unable to create account right now." });
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

apiRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email/phone and password are required." });
  }

  try {
    const ident = parsed.data.identifier.trim().toLowerCase();
    const found = await db
      .select()
      .from(users)
      .where(or(eq(users.email, ident), eq(users.phone, parsed.data.identifier.trim())))
      .limit(1);

    if (found.length === 0 || !found[0].passwordHash) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = verifyPassword(parsed.data.password, found[0].passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (!found[0].isActive) {
      return res.status(403).json({ error: "Account is deactivated." });
    }

    const accessToken = signAppToken(found[0].uid, found[0].email, "access");
    const refreshToken = signAppToken(found[0].uid, found[0].email, "refresh");

    res.json({
      user: mapDbUser(found[0]),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Unable to sign in." });
  }
});

apiRouter.post("/auth/refresh", async (req, res) => {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  const decoded = verifyAppToken(token);
  if (!decoded || decoded.type !== "refresh") {
    return res.status(401).json({ error: "Invalid refresh token." });
  }
  const found = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
  if (found.length === 0 || !found[0].isActive) {
    return res.status(401).json({ error: "Account unavailable." });
  }
  res.json({
    accessToken: signAppToken(found[0].uid, found[0].email, "access"),
    refreshToken: signAppToken(found[0].uid, found[0].email, "refresh"),
  });
});

apiRouter.post("/auth/sync", requireAuth, async (req: AuthRequest, res) => {
  const user = req.authUser!;
  const sessionKey = req.headers["x-cart-session"] as string | undefined;
  if (sessionKey) {
    await getOrCreateCart(user.id, sessionKey);
  }
  const [userAddresses, userWishlists, userBookmarks, unreadNotifs] = await Promise.all([
    db.select().from(addresses).where(eq(addresses.userId, user.id)),
    db.select().from(wishlists).where(eq(wishlists.userId, user.id)),
    db.select().from(articleBookmarks).where(eq(articleBookmarks.userId, user.id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
  ]);

  res.json({
    user,
    addresses: userAddresses,
    wishlistProductIds: userWishlists.map((w) => w.productId),
    bookmarkedArticleIds: userBookmarks.map((b) => b.articleId),
    unreadNotificationCount: Number(unreadNotifs[0]?.count ?? 0),
  });
});

apiRouter.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const user = req.authUser!;
  const [userAddresses, userWishlists, userBookmarks] = await Promise.all([
    db.select().from(addresses).where(eq(addresses.userId, user.id)),
    db.select().from(wishlists).where(eq(wishlists.userId, user.id)),
    db.select().from(articleBookmarks).where(eq(articleBookmarks.userId, user.id)),
  ]);
  res.json({
    user,
    addresses: userAddresses,
    wishlistProductIds: userWishlists.map((w) => w.productId),
    bookmarkedArticleIds: userBookmarks.map((b) => b.articleId),
  });
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().min(7).max(25).optional().nullable(),
  preferredBrands: z.array(z.string()).optional(),
  notificationPrefs: z
    .object({
      orders: z.boolean(),
      swaps: z.boolean(),
      learn: z.boolean(),
      promotions: z.boolean(),
    })
    .optional(),
});

apiRouter.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid profile update", details: parsed.error.flatten() });
  }
  const [updated] = await db
    .update(users)
    .set({
      ...(parsed.data.fullName ? { fullName: parsed.data.fullName.trim() } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() || null } : {}),
      ...(parsed.data.preferredBrands ? { preferredBrands: parsed.data.preferredBrands } : {}),
      ...(parsed.data.notificationPrefs ? { notificationPrefs: parsed.data.notificationPrefs } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.authUser!.id))
    .returning();

  res.json({ user: mapDbUser(updated) });
});

const addressSchema = z.object({
  label: z.string().min(2).max(50),
  recipientName: z.string().min(2).max(100),
  phone: z.string().min(7).max(25),
  district: z.string().min(2).max(60),
  area: z.string().min(2).max(80),
  streetDetails: z.string().min(3).max(200),
  isDefault: z.boolean().optional(),
});

apiRouter.post("/auth/addresses", requireAuth, async (req: AuthRequest, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid address", details: parsed.error.flatten() });
  }
  if (parsed.data.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.authUser!.id));
  }
  const [created] = await db
    .insert(addresses)
    .values({
      userId: req.authUser!.id,
      ...parsed.data,
      isDefault: Boolean(parsed.data.isDefault),
    })
    .returning();
  res.status(201).json({ address: created });
});

apiRouter.delete("/auth/addresses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, req.authUser!.id)));
  res.json({ deleted: true });
});

apiRouter.post("/auth/deletion-request", requireAuth, async (req: AuthRequest, res) => {
  const [updated] = await db
    .update(users)
    .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, req.authUser!.id))
    .returning();
  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "account_deletion_requested",
    entityType: "user",
    entityId: String(req.authUser!.id),
  });
  res.json({
    requestedAt: updated.deletionRequestedAt,
    message: "Account deletion request recorded. Active orders/swaps must settle before permanent erasure.",
  });
});

// ==================== CATALOGUE & SEARCH ====================
apiRouter.get("/catalog/bootstrap", optionalAuth, async (req: AuthRequest, res) => {
  try {
    const [brandRows, catRows, zoneRows, prodRows, articleRows, videoRows, settingRows] = await Promise.all([
      db.select().from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.sortOrder)),
      db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
      db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.feeUgx)),
      db.select().from(products).where(eq(products.isActive, true)).orderBy(desc(products.createdAt)),
      db.select().from(articles).where(eq(articles.isPublished, true)).orderBy(desc(articles.publishedAt)).limit(6),
      db.select().from(tiktokVideos).where(eq(tiktokVideos.isAvailable, true)).orderBy(asc(tiktokVideos.displayOrder)),
      db.select().from(storeSettings).where(eq(storeSettings.key, "store_info")).limit(1),
    ]);

    const hydrated = await hydrateProducts(prodRows);
    const preferred = req.authUser?.preferredBrands ?? [];
    const recommended =
      preferred.length > 0
        ? hydrated.filter((p) => preferred.includes(p.brand?.name || ""))
        : hydrated.filter((p) => p.isFeatured).slice(0, 4);

    res.json({
      brands: brandRows,
      categories: catRows,
      deliveryZones: zoneRows,
      featuredProducts: hydrated.filter((p) => p.isFeatured),
      bestSellers: hydrated.filter((p) => p.isBestSeller),
      recentProducts: hydrated.slice(0, 6),
      recommendedProducts: recommended.length > 0 ? recommended : hydrated.slice(0, 4),
      allProducts: hydrated,
      learnArticles: articleRows,
      tiktokVideos: videoRows,
      storeInfo: settingRows[0]?.value ?? null,
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    res.status(500).json({ error: "Failed to load Century Gadgets storefront data." });
  }
});

apiRouter.get("/catalog/products", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const brandSlug = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
    const categorySlug = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const condition = typeof req.query.condition === "string" ? req.query.condition.trim() : "";
    const storage = typeof req.query.storage === "string" ? req.query.storage.trim() : "";
    const inStock = req.query.inStock === "true";
    const minPrice = Number(req.query.minPrice) || 0;
    const maxPrice = Number(req.query.maxPrice) || 0;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "popularity";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const conditions = [eq(products.isActive, true)];
    if (q) {
      conditions.push(or(ilike(products.name, `%${q}%`), ilike(products.model, `%${q}%`), ilike(products.description, `%${q}%`))!);
    }
    if (condition && ["new", "refurbished", "used"].includes(condition)) {
      conditions.push(eq(products.condition, condition));
    }
    if (minPrice > 0) {
      conditions.push(gte(products.basePriceUgx, minPrice));
    }
    if (maxPrice > 0) {
      conditions.push(lte(products.basePriceUgx, maxPrice));
    }
    if (brandSlug) {
      const b = await db.select().from(brands).where(eq(brands.slug, brandSlug)).limit(1);
      if (b.length > 0) conditions.push(eq(products.brandId, b[0].id));
    }
    if (categorySlug) {
      const c = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
      if (c.length > 0) conditions.push(eq(products.categoryId, c[0].id));
    }

    const orderByClause =
      sort === "price_asc"
        ? asc(products.basePriceUgx)
        : sort === "price_desc"
          ? desc(products.basePriceUgx)
          : sort === "newest"
            ? desc(products.createdAt)
            : desc(products.popularityScore);

    const matched = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(orderByClause);

    let hydrated = await hydrateProducts(matched);

    if (storage) {
      hydrated = hydrated.filter((p) => p.variants.some((v) => v.storage.toLowerCase() === storage.toLowerCase()));
    }
    if (inStock) {
      hydrated = hydrated.filter((p) => p.totalAvailableStock > 0);
    }

    const total = hydrated.length;
    const offset = (page - 1) * limit;
    const items = hydrated.slice(offset, offset + limit);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("Catalogue query error:", err);
    res.status(500).json({ error: "Failed to load products." });
  }
});

apiRouter.get("/catalog/autocomplete", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.json({ suggestions: [] });

  const matched = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      model: products.model,
      basePriceUgx: products.basePriceUgx,
    })
    .from(products)
    .where(and(eq(products.isActive, true), or(ilike(products.name, `%${q}%`), ilike(products.model, `%${q}%`))))
    .limit(6);

  res.json({ suggestions: matched });
});

apiRouter.get("/catalog/compare", async (req, res) => {
  const raw = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = raw
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 4);

  if (ids.length === 0) return res.json({ products: [] });
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const hydrated = await hydrateProducts(rows);
  res.json({ products: hydrated });
});

apiRouter.get("/catalog/products/:idOrSlug", async (req, res) => {
  const param = req.params.idOrSlug;
  const numericId = Number(param);
  const rows = await db
    .select()
    .from(products)
    .where(Number.isInteger(numericId) && numericId > 0 ? eq(products.id, numericId) : eq(products.slug, param))
    .limit(1);

  if (rows.length === 0) {
    return res.status(404).json({ error: "Product not found." });
  }

  const [hydrated] = await hydrateProducts(rows);
  const [approvedReviews, accessoryRows, zoneRows] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, hydrated.id), eq(reviews.isApproved, true)))
      .orderBy(desc(reviews.createdAt)),
    db
      .select()
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(categories.slug, "accessories"), eq(products.isActive, true)))
      .limit(4),
    db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.feeUgx)),
  ]);

  const relatedAccessories = await hydrateProducts(accessoryRows.map((a) => a.products));

  res.json({
    product: hydrated,
    reviews: approvedReviews,
    relatedAccessories,
    deliveryZones: zoneRows,
  });
});

apiRouter.post("/catalog/wishlist/:productId", requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  const existing = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, req.authUser!.id), eq(wishlists.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
    return res.json({ saved: false, productId });
  }

  await db.insert(wishlists).values({ userId: req.authUser!.id, productId });
  res.json({ saved: true, productId });
});

apiRouter.post("/catalog/products/:productId/reviews", requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(6).max(800),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Rating (1-5) and comment (min 6 chars) are required." });
  }

  // Verify if customer actually purchased this product
  const purchased = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, req.authUser!.id),
        eq(orderItems.productId, productId),
        inArray(orders.paymentStatus, ["successful"])
      )
    )
    .limit(1);

  const [created] = await db
    .insert(reviews)
    .values({
      productId,
      userId: req.authUser!.id,
      authorName: req.authUser!.fullName,
      rating: parsed.data.rating,
      comment: parsed.data.comment.trim(),
      isVerifiedPurchase: purchased.length > 0,
      isApproved: false, // Subject to moderation
    })
    .returning();

  res.status(201).json({
    review: created,
    message: "Review submitted for verification and staff moderation.",
  });
});

// ==================== CART & CHECKOUT ====================
apiRouter.get("/cart", optionalAuth, async (req: AuthRequest, res) => {
  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;
  const zoneId = Number(req.query.deliveryZoneId) || undefined;
  const cartRow = await getOrCreateCart(req.authUser?.id, sessionKey);
  const hydrated = await hydrateCart(cartRow, zoneId);
  res.json(hydrated);
});

apiRouter.post("/cart/items", optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid variant or quantity." });
  }

  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;
  const cartRow = await getOrCreateCart(req.authUser?.id, sessionKey);

  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, parsed.data.variantId), eq(productVariants.isActive, true)))
    .limit(1);

  if (variants.length === 0) {
    return res.status(404).json({ error: "Selected variant does not exist." });
  }

  const available = Math.max(0, variants[0].stockQty - variants[0].reservedQty);
  const existingItem = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.variantId, parsed.data.variantId)))
    .limit(1);

  const desiredQty = (existingItem[0]?.quantity ?? 0) + parsed.data.quantity;
  if (desiredQty > available) {
    return res.status(409).json({ error: `Only ${available} unit(s) currently available in stock.` });
  }

  if (existingItem.length > 0) {
    await db.update(cartItems).set({ quantity: desiredQty }).where(eq(cartItems.id, existingItem[0].id));
  } else {
    await db.insert(cartItems).values({
      cartId: cartRow.id,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    });
  }

  const hydrated = await hydrateCart(cartRow);
  res.json(hydrated);
});

apiRouter.patch("/cart/items/:variantId", optionalAuth, async (req: AuthRequest, res) => {
  const variantId = Number(req.params.variantId);
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
    return res.status(400).json({ error: "Quantity must be between 0 and 20." });
  }

  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;
  const cartRow = await getOrCreateCart(req.authUser?.id, sessionKey);

  if (quantity === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.variantId, variantId)));
  } else {
    const variants = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (variants.length === 0) return res.status(404).json({ error: "Variant not found." });
    const available = Math.max(0, variants[0].stockQty - variants[0].reservedQty);
    if (quantity > available) {
      return res.status(409).json({ error: `Only ${available} unit(s) available.` });
    }
    await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.variantId, variantId)));
  }

  const hydrated = await hydrateCart(cartRow);
  res.json(hydrated);
});

apiRouter.delete("/cart/items/:variantId", optionalAuth, async (req: AuthRequest, res) => {
  const variantId = Number(req.params.variantId);
  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;
  const cartRow = await getOrCreateCart(req.authUser?.id, sessionKey);
  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.variantId, variantId)));
  const hydrated = await hydrateCart(cartRow);
  res.json(hydrated);
});

apiRouter.post("/cart/discount", optionalAuth, async (req: AuthRequest, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;
  const cartRow = await getOrCreateCart(req.authUser?.id, sessionKey);

  if (!code) {
    const [updated] = await db.update(carts).set({ discountCode: null, updatedAt: new Date() }).where(eq(carts.id, cartRow.id)).returning();
    return res.json(await hydrateCart(updated));
  }

  const found = await db
    .select()
    .from(discountCodes)
    .where(and(eq(discountCodes.code, code), eq(discountCodes.isActive, true)))
    .limit(1);

  if (found.length === 0) {
    return res.status(404).json({ error: "Discount code not found or inactive." });
  }
  if (found[0].maxUses !== null && found[0].usedCount >= found[0].maxUses) {
    return res.status(400).json({ error: "Discount code usage limit reached." });
  }
  if (found[0].expiresAt && found[0].expiresAt < new Date()) {
    return res.status(400).json({ error: "Discount code has expired." });
  }

  const [updated] = await db
    .update(carts)
    .set({ discountCode: code, updatedAt: new Date() })
    .where(eq(carts.id, cartRow.id))
    .returning();

  const hydrated = await hydrateCart(updated);
  if (hydrated.subtotalUgx < found[0].minOrderUgx) {
    return res.status(400).json({
      error: `Minimum order of UGX ${found[0].minOrderUgx.toLocaleString()} required for ${code}.`,
    });
  }
  res.json(hydrated);
});

const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  deliveryZoneId: z.number().int().positive(),
  collectionOption: z.enum(["delivery", "store_pickup"]),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(7).max(25),
  customerEmail: z.string().email(),
  deliveryAddress: z.string().min(3).max(300),
  deliveryNotes: z.string().max(300).optional(),
  paymentMethod: z.enum(["mtn_momo", "airtel_money", "card", "cash_on_collection"]),
  payerPhone: z.string().max(25).optional(),
  discountCode: z.string().max(40).optional(),
});

apiRouter.post("/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid checkout form data", details: parsed.error.flatten() });
  }

  const user = req.authUser!;
  const sessionKey = (req.headers["x-cart-session"] as string | undefined) || undefined;

  try {
    const result = await db.transaction(async (tx) => {
      // Idempotency guard against duplicate submissions
      const existingOrder = await tx
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, parsed.data.idempotencyKey))
        .limit(1);

      if (existingOrder.length > 0) {
        const existingPay = await tx
          .select()
          .from(payments)
          .where(eq(payments.orderId, existingOrder[0].id))
          .limit(1);
        return { order: existingOrder[0], payment: existingPay[0] ?? null, deduplicated: true };
      }

      // Find user cart
      const cartRow = await getOrCreateCart(user.id, sessionKey);
      const items = await tx
        .select({
          cartItemId: cartItems.id,
          quantity: cartItems.quantity,
          variantId: productVariants.id,
          productId: products.id,
          productName: products.name,
          storage: productVariants.storage,
          color: productVariants.color,
          priceUgx: productVariants.priceUgx,
          stockQty: productVariants.stockQty,
          reservedQty: productVariants.reservedQty,
        })
        .from(cartItems)
        .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(cartItems.cartId, cartRow.id));

      if (items.length === 0) {
        throw new Error("CART_EMPTY");
      }

      // Stock validation & reservation
      for (const item of items) {
        const available = item.stockQty - item.reservedQty;
        if (item.quantity > available) {
          throw new Error(`INSUFFICIENT_STOCK:${item.productName} (${item.storage})`);
        }
      }

      const zones = await tx
        .select()
        .from(deliveryZones)
        .where(and(eq(deliveryZones.id, parsed.data.deliveryZoneId), eq(deliveryZones.isActive, true)))
        .limit(1);
      if (zones.length === 0) {
        throw new Error("INVALID_ZONE");
      }

      const activeCode = (parsed.data.discountCode || cartRow.discountCode || "").trim().toUpperCase();
      let discountRow = null;
      if (activeCode) {
        const foundCodes = await tx
          .select()
          .from(discountCodes)
          .where(and(eq(discountCodes.code, activeCode), eq(discountCodes.isActive, true)))
          .limit(1);
        if (foundCodes.length > 0) discountRow = foundCodes[0];
      }

      const totals = calculateCartTotals(
        items.map((i) => ({ unitPriceUgx: i.priceUgx, quantity: i.quantity })),
        discountRow,
        zones[0].feeUgx
      );

      const orderRef = `CG-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderRef,
          userId: user.id,
          status: parsed.data.paymentMethod === "cash_on_collection" ? "confirmed" : "pending_payment",
          paymentStatus: "pending",
          paymentMethod: parsed.data.paymentMethod,
          subtotalUgx: totals.subtotalUgx,
          discountUgx: totals.discountUgx,
          deliveryFeeUgx: totals.deliveryFeeUgx,
          totalUgx: totals.totalUgx,
          discountCode: totals.appliedDiscountCode,
          deliveryZoneId: zones[0].id,
          collectionOption: parsed.data.collectionOption,
          customerName: parsed.data.customerName.trim(),
          customerPhone: parsed.data.customerPhone.trim(),
          customerEmail: parsed.data.customerEmail.trim(),
          deliveryAddress: parsed.data.deliveryAddress.trim(),
          deliveryNotes: parsed.data.deliveryNotes?.trim() || "",
          idempotencyKey: parsed.data.idempotencyKey,
        })
        .returning();

      for (const item of items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productNameSnapshot: item.productName,
          variantSnapshot: `${item.storage} · ${item.color}`,
          unitPriceUgx: item.priceUgx,
          quantity: item.quantity,
          lineTotalUgx: item.priceUgx * item.quantity,
        });

        await tx
          .update(productVariants)
          .set({ reservedQty: item.reservedQty + item.quantity })
          .where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryMovements).values({
          variantId: item.variantId,
          deltaQty: -item.quantity,
          previousQty: item.stockQty - item.reservedQty,
          newQty: item.stockQty - (item.reservedQty + item.quantity),
          reason: `Stock reserved for order ${orderRef}`,
          referenceType: "order",
          referenceId: orderRef,
          actorUserId: user.id,
        });
      }

      if (totals.appliedDiscountCode && discountRow) {
        await tx
          .update(discountCodes)
          .set({ usedCount: discountRow.usedCount + 1 })
          .where(eq(discountCodes.id, discountRow.id));
      }

      const providerRef = `PAY-SBX-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const [newPayment] = await tx
        .insert(payments)
        .values({
          orderId: newOrder.id,
          provider:
            parsed.data.paymentMethod === "cash_on_collection"
              ? "cash_on_collection"
              : `${parsed.data.paymentMethod}_sandbox`,
          providerRef,
          amountUgx: totals.totalUgx,
          currency: "UGX",
          status: "pending",
          isSimulated: parsed.data.paymentMethod !== "cash_on_collection",
          payerPhoneMasked: parsed.data.payerPhone ? maskPhone(parsed.data.payerPhone) : null,
          idempotencyKey: `pay-${parsed.data.idempotencyKey}`,
        })
        .returning();

      await tx.delete(cartItems).where(eq(cartItems.cartId, cartRow.id));
      await tx.update(carts).set({ discountCode: null, updatedAt: new Date() }).where(eq(carts.id, cartRow.id));

      await tx.insert(notifications).values({
        userId: user.id,
        title: `Order ${orderRef} created`,
        body:
          parsed.data.paymentMethod === "cash_on_collection"
            ? `Your order total is UGX ${totals.totalUgx.toLocaleString()}. Pay upon store collection.`
            : `Order total UGX ${totals.totalUgx.toLocaleString()}. Complete payment authorization to confirm dispatch.`,
        category: "order",
        referenceType: "order",
        referenceId: orderRef,
      });

      return { order: newOrder, payment: newPayment, deduplicated: false };
    });

    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err: any) {
    if (err.message === "CART_EMPTY") {
      return res.status(400).json({ error: "Your shopping cart is empty." });
    }
    if (err.message?.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(409).json({ error: `Insufficient stock for ${err.message.split(":")[1]}.` });
    }
    if (err.message === "INVALID_ZONE") {
      return res.status(400).json({ error: "Selected delivery zone is invalid." });
    }
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Unable to process checkout." });
  }
});

// ==================== PAYMENTS & VERIFIED WEBHOOKS ====================
async function processVerifiedWebhook(payload: {
  providerRef: string;
  status: "successful" | "failed" | "cancelled";
  externalTxId?: string;
}) {
  return db.transaction(async (tx) => {
    const payRows = await tx
      .select()
      .from(payments)
      .where(eq(payments.providerRef, payload.providerRef))
      .limit(1);

    if (payRows.length === 0) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const pay = payRows[0];
    if (pay.status === "successful" && payload.status === "successful") {
      return { payment: pay, alreadyProcessed: true };
    }

    const [updatedPay] = await tx
      .update(payments)
      .set({
        status: payload.status,
        rawWebhookPayload: payload,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pay.id))
      .returning();

    if (pay.orderId) {
      const orderRows = await tx.select().from(orders).where(eq(orders.id, pay.orderId)).limit(1);
      if (orderRows.length > 0) {
        const order = orderRows[0];
        if (payload.status === "successful") {
          await tx
            .update(orders)
            .set({ status: "paid", paymentStatus: "successful", updatedAt: new Date() })
            .where(eq(orders.id, order.id));

          // Convert reservedQty into final stockQty deduction
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
          for (const item of items) {
            const vRows = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
            if (vRows.length > 0) {
              const v = vRows[0];
              await tx
                .update(productVariants)
                .set({
                  stockQty: Math.max(0, v.stockQty - item.quantity),
                  reservedQty: Math.max(0, v.reservedQty - item.quantity),
                })
                .where(eq(productVariants.id, v.id));
            }
          }

          await tx.insert(notifications).values({
            userId: order.userId,
            title: `Payment confirmed for ${order.orderRef}`,
            body: `${pay.isSimulated ? "[SANDBOX] " : ""}Payment of UGX ${pay.amountUgx.toLocaleString()} verified. Your order is now being prepared.`,
            category: "payment",
            referenceType: "order",
            referenceId: order.orderRef,
          });
        } else {
          await tx
            .update(orders)
            .set({ paymentStatus: payload.status, updatedAt: new Date() })
            .where(eq(orders.id, order.id));

          await tx.insert(notifications).values({
            userId: order.userId,
            title: `Payment ${payload.status} for ${order.orderRef}`,
            body: `Your payment attempt did not succeed (${payload.status}). Please retry or select another payment method.`,
            category: "payment",
            referenceType: "order",
            referenceId: order.orderRef,
          });
        }
      }
    }

    if (pay.swapRequestId && payload.status === "successful") {
      const swapRows = await tx.select().from(swapRequests).where(eq(swapRequests.id, pay.swapRequestId)).limit(1);
      if (swapRows.length > 0) {
        const swap = swapRows[0];
        await tx
          .update(swapRequests)
          .set({ status: "awaiting_exchange", updatedAt: new Date() })
          .where(eq(swapRequests.id, swap.id));
        await tx.insert(swapStatusHistory).values({
          swapRequestId: swap.id,
          fromStatus: swap.status,
          toStatus: "awaiting_exchange",
          note: `Balance payment verified (${pay.providerRef}${pay.isSimulated ? " - SANDBOX" : ""})`,
        });
        await tx.insert(notifications).values({
          userId: swap.userId,
          title: `Swap balance verified (${swap.swapRef})`,
          body: `Payment of UGX ${pay.amountUgx.toLocaleString()} verified. Ready for device handover.`,
          category: "swap",
          referenceType: "swap",
          referenceId: swap.swapRef,
        });
      }
    }

    return { payment: updatedPay, alreadyProcessed: false };
  });
}

apiRouter.post("/payments/webhook", async (req, res) => {
  const sigHeader = req.headers["x-century-signature"] as string | undefined;
  const payloadString = JSON.stringify(req.body);
  if (!verifyPaymentWebhookSignature(payloadString, sigHeader, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const schema = z.object({
    providerRef: z.string().min(3),
    status: z.enum(["successful", "failed", "cancelled"]),
    externalTxId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid webhook payload." });
  }

  try {
    const result = await processVerifiedWebhook(parsed.data);
    res.json(result);
  } catch (err: any) {
    if (err.message === "PAYMENT_NOT_FOUND") {
      return res.status(404).json({ error: "Payment reference not found." });
    }
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// Sandbox helper that routes through the exact HMAC-verified webhook handler
apiRouter.post("/payments/sandbox-confirm", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    providerRef: z.string().min(3),
    outcome: z.enum(["successful", "failed", "cancelled"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid sandbox confirmation request." });
  }

  const payRows = await db.select().from(payments).where(eq(payments.providerRef, parsed.data.providerRef)).limit(1);
  if (payRows.length === 0) return res.status(404).json({ error: "Payment not found." });
  if (!payRows[0].isSimulated) {
    return res.status(400).json({ error: "Only sandbox payments can be simulated via this endpoint." });
  }

  const payload = {
    providerRef: parsed.data.providerRef,
    status: parsed.data.outcome,
    externalTxId: `SBX-${Date.now()}`,
  };
  const sig = signPaymentWebhookPayload(JSON.stringify(payload), WEBHOOK_SECRET);
  if (!verifyPaymentWebhookSignature(JSON.stringify(payload), sig, WEBHOOK_SECRET)) {
    return res.status(500).json({ error: "Signature check failed." });
  }

  const result = await processVerifiedWebhook(payload);
  res.json({ ...result, isSimulated: true, label: "SANDBOX TRANSACTION — NOT REAL MONEY" });
});

// ==================== CUSTOMER ORDERS ====================
apiRouter.get("/orders", requireAuth, async (req: AuthRequest, res) => {
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, req.authUser!.id))
    .orderBy(desc(orders.createdAt));

  const orderIds = userOrders.map((o) => o.id);
  const [items, payRows] =
    orderIds.length > 0
      ? await Promise.all([
          db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
          db.select().from(payments).where(inArray(payments.orderId, orderIds)),
        ])
      : [[], []];

  res.json({
    orders: userOrders.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
      payments: payRows.filter((p) => p.orderId === o.id),
    })),
  });
});

apiRouter.get("/orders/:idOrRef", requireAuth, async (req: AuthRequest, res) => {
  const param = req.params.idOrRef;
  const numId = Number(param);
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, req.authUser!.id),
        Number.isInteger(numId) && numId > 0 ? eq(orders.id, numId) : eq(orders.orderRef, param)
      )
    )
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: "Order not found." });
  const [items, payRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, rows[0].id)),
    db.select().from(payments).where(eq(payments.orderId, rows[0].id)),
  ]);
  res.json({ order: { ...rows[0], items, payments: payRows } });
});

apiRouter.post("/orders/:id/cancel-request", requireAuth, async (req: AuthRequest, res) => {
  const orderId = Number(req.params.id);
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, req.authUser!.id)))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: "Order not found." });
  const order = rows[0];

  if (!["pending_payment", "paid", "confirmed"].includes(order.status)) {
    return res.status(400).json({ error: "Orders already dispatched or delivered require staff support assistance." });
  }

  const nextStatus = order.paymentStatus === "successful" ? "refund_pending" : "cancelled";
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: nextStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
    if (nextStatus === "cancelled") {
      // Release reserved stock
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        const vRows = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
        if (vRows.length > 0) {
          await tx
            .update(productVariants)
            .set({ reservedQty: Math.max(0, vRows[0].reservedQty - item.quantity) })
            .where(eq(productVariants.id, item.variantId));
        }
      }
    }
  });

  res.json({ status: nextStatus });
});

// ==================== PHONE SWAP & TRADE-IN SYSTEM ====================
async function hydrateSwaps(swapRows: Array<typeof swapRequests.$inferSelect>) {
  if (swapRows.length === 0) return [];
  const ids = swapRows.map((s) => s.id);
  const productIds = [...new Set(swapRows.map((s) => s.targetProductId))];
  const variantIds = [...new Set(swapRows.map((s) => s.targetVariantId))];

  const [photos, valuations, history, appts, msgs, targetProds, targetVars, targetImgs] = await Promise.all([
    db.select().from(swapPhotos).where(inArray(swapPhotos.swapRequestId, ids)),
    db.select().from(swapValuations).where(inArray(swapValuations.swapRequestId, ids)).orderBy(asc(swapValuations.createdAt)),
    db.select().from(swapStatusHistory).where(inArray(swapStatusHistory.swapRequestId, ids)).orderBy(asc(swapStatusHistory.createdAt)),
    db.select().from(inspectionAppointments).where(inArray(inspectionAppointments.swapRequestId, ids)),
    db.select().from(swapMessages).where(inArray(swapMessages.swapRequestId, ids)).orderBy(asc(swapMessages.createdAt)),
    db.select().from(products).where(inArray(products.id, productIds)),
    db.select().from(productVariants).where(inArray(productVariants.id, variantIds)),
    db.select().from(productImages).where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true))),
  ]);

  const prodMap = Object.fromEntries(targetProds.map((p) => [p.id, p]));
  const varMap = Object.fromEntries(targetVars.map((v) => [v.id, v]));
  const imgMap = Object.fromEntries(targetImgs.map((i) => [i.productId, i.url]));

  return swapRows.map((s) => ({
    ...s,
    targetProduct: prodMap[s.targetProductId]
      ? { ...prodMap[s.targetProductId], primaryImageUrl: imgMap[s.targetProductId] || "media:iphone" }
      : null,
    targetVariant: varMap[s.targetVariantId] ?? null,
    photos: photos.filter((p) => p.swapRequestId === s.id),
    valuations: valuations.filter((v) => v.swapRequestId === s.id),
    statusHistory: history.filter((h) => h.swapRequestId === s.id),
    appointments: appts.filter((a) => a.swapRequestId === s.id),
    messages: msgs.filter((m) => m.swapRequestId === s.id),
  }));
}

const createSwapSchema = z.object({
  targetProductId: z.number().int().positive(),
  targetVariantId: z.number().int().positive(),
  currentBrand: z.string().min(2).max(50),
  currentModel: z.string().min(2).max(80),
  currentStorage: z.string().min(2).max(30),
  currentColor: z.string().min(2).max(40),
  physicalCondition: z.enum(["mint", "good", "fair", "damaged"]),
  batteryCondition: z.string().min(2).max(80),
  screenCondition: z.enum(["flawless", "minor_scratches", "cracked"]),
  cameraCondition: z.string().min(2).max(80),
  powersOn: z.boolean(),
  hasBeenRepaired: z.boolean(),
  includesBoxOrAccessories: z.string().min(2).max(120),
  ownershipDeclared: z.literal(true),
  photos: z
    .array(
      z.object({
        angleLabel: z.string().min(2).max(40),
        url: z.string().min(4).max(500),
      })
    )
    .min(1)
    .max(6),
});

apiRouter.get("/swaps", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(swapRequests)
    .where(eq(swapRequests.userId, req.authUser!.id))
    .orderBy(desc(swapRequests.createdAt));

  res.json({ swaps: await hydrateSwaps(rows) });
});

apiRouter.post("/swaps", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSwapSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please complete all required phone swap details and declarations.", details: parsed.error.flatten() });
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, parsed.data.targetVariantId), eq(productVariants.productId, parsed.data.targetProductId)))
    .limit(1);

  if (variants.length === 0) {
    return res.status(404).json({ error: "Selected target phone variant was not found." });
  }

  const targetPriceUgx = variants[0].priceUgx;
  const estimate = calculateProvisionalSwapEstimate({
    targetPriceUgx,
    currentBrand: parsed.data.currentBrand,
    physicalCondition: parsed.data.physicalCondition,
    screenCondition: parsed.data.screenCondition,
    powersOn: parsed.data.powersOn,
    hasBeenRepaired: parsed.data.hasBeenRepaired,
    includesBoxOrAccessories: parsed.data.includesBoxOrAccessories,
  });

  const swapRef = `SWP-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  const created = await db.transaction(async (tx) => {
    const [swap] = await tx
      .insert(swapRequests)
      .values({
        swapRef,
        userId: req.authUser!.id,
        targetProductId: parsed.data.targetProductId,
        targetVariantId: parsed.data.targetVariantId,
        currentBrand: parsed.data.currentBrand,
        currentModel: parsed.data.currentModel,
        currentStorage: parsed.data.currentStorage,
        currentColor: parsed.data.currentColor,
        physicalCondition: parsed.data.physicalCondition,
        batteryCondition: parsed.data.batteryCondition,
        screenCondition: parsed.data.screenCondition,
        cameraCondition: parsed.data.cameraCondition,
        powersOn: parsed.data.powersOn,
        hasBeenRepaired: parsed.data.hasBeenRepaired,
        includesBoxOrAccessories: parsed.data.includesBoxOrAccessories,
        ownershipDeclared: true,
        status: "submitted",
        provisionalEstimateUgx: estimate.provisionalEstimateUgx,
        targetPriceUgx,
        payableDifferenceUgx: estimate.provisionalPayableDifferenceUgx,
      })
      .returning();

    for (const p of parsed.data.photos) {
      await tx.insert(swapPhotos).values({
        swapRequestId: swap.id,
        angleLabel: p.angleLabel,
        url: p.url,
      });
    }

    await tx.insert(swapValuations).values({
      swapRequestId: swap.id,
      stage: "provisional",
      amountUgx: estimate.provisionalEstimateUgx,
      payableDifferenceUgx: estimate.provisionalPayableDifferenceUgx,
      notes: "Automated provisional estimate only. Final valuation requires Century Gadgets assessor review and physical inspection.",
      customerDecision: null,
    });

    await tx.insert(swapStatusHistory).values({
      swapRequestId: swap.id,
      fromStatus: "draft",
      toStatus: "submitted",
      note: "Swap request and device photographs submitted by customer.",
      actorUserId: req.authUser!.id,
    });

    await tx.insert(notifications).values({
      userId: req.authUser!.id,
      title: `Swap request ${swapRef} submitted`,
      body: `Provisional estimate: UGX ${estimate.provisionalEstimateUgx.toLocaleString()} (subject to review and inspection).`,
      category: "swap",
      referenceType: "swap",
      referenceId: swapRef,
    });

    return swap;
  });

  const [hydrated] = await hydrateSwaps([created]);
  res.status(201).json({ swap: hydrated });
});

apiRouter.post("/swaps/:id/respond", requireAuth, async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const decision = req.body?.decision === "accepted" ? "accepted" : req.body?.decision === "declined" ? "declined" : null;
  if (!decision) return res.status(400).json({ error: "Decision must be 'accepted' or 'declined'." });

  const rows = await db
    .select()
    .from(swapRequests)
    .where(and(eq(swapRequests.id, swapId), eq(swapRequests.userId, req.authUser!.id)))
    .limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });

  const swap = rows[0];
  const latestValuations = await db
    .select()
    .from(swapValuations)
    .where(eq(swapValuations.swapRequestId, swap.id))
    .orderBy(desc(swapValuations.createdAt))
    .limit(1);

  if (latestValuations.length === 0 || latestValuations[0].stage === "provisional") {
    return res.status(400).json({ error: "Wait for a staff-issued offer before responding." });
  }

  const latestVal = latestValuations[0];
  let nextStatus = decision === "declined" ? "offer_declined" : "offer_accepted";
  if (decision === "accepted" && latestVal.stage === "post_inspection_revised") {
    nextStatus = swap.payableDifferenceUgx > 0 ? "awaiting_payment" : "awaiting_exchange";
  }

  await db.transaction(async (tx) => {
    await tx
      .update(swapValuations)
      .set({ customerDecision: decision, customerDecisionAt: new Date() })
      .where(eq(swapValuations.id, latestVal.id));

    await tx
      .update(swapRequests)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(swapRequests.id, swap.id));

    await tx.insert(swapStatusHistory).values({
      swapRequestId: swap.id,
      fromStatus: swap.status,
      toStatus: nextStatus,
      note: `Customer ${decision} valuation of UGX ${latestVal.amountUgx.toLocaleString()}.`,
      actorUserId: req.authUser!.id,
    });
  });

  const updatedRows = await db.select().from(swapRequests).where(eq(swapRequests.id, swap.id));
  const [hydrated] = await hydrateSwaps(updatedRows);
  res.json({ swap: hydrated });
});

apiRouter.post("/swaps/:id/appointment", requireAuth, async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const schema = z.object({
    scheduledDate: z.string().min(6).max(30),
    timeSlot: z.string().min(3).max(40),
    locationType: z.enum(["store_dropoff", "scheduled_inspection"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid date, time slot, and location type required." });

  const rows = await db
    .select()
    .from(swapRequests)
    .where(and(eq(swapRequests.id, swapId), eq(swapRequests.userId, req.authUser!.id)))
    .limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });

  const swap = rows[0];
  await db.transaction(async (tx) => {
    await tx.insert(inspectionAppointments).values({
      swapRequestId: swap.id,
      scheduledDate: parsed.data.scheduledDate,
      timeSlot: parsed.data.timeSlot,
      locationType: parsed.data.locationType,
      locationDetails: "Century Gadgets Flagship Desk — Mabirizi Complex Level 2, Shop L2-14, Kampala Rd",
      status: "scheduled",
    });

    await tx
      .update(swapRequests)
      .set({ status: "inspection_scheduled", updatedAt: new Date() })
      .where(eq(swapRequests.id, swap.id));

    await tx.insert(swapStatusHistory).values({
      swapRequestId: swap.id,
      fromStatus: swap.status,
      toStatus: "inspection_scheduled",
      note: `Inspection booked for ${parsed.data.scheduledDate} (${parsed.data.timeSlot}).`,
      actorUserId: req.authUser!.id,
    });
  });

  const updated = await db.select().from(swapRequests).where(eq(swapRequests.id, swap.id));
  const [hydrated] = await hydrateSwaps(updated);
  res.status(201).json({ swap: hydrated });
});

apiRouter.post("/swaps/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length < 2) return res.status(400).json({ error: "Message cannot be empty." });

  const rows = await db
    .select()
    .from(swapRequests)
    .where(and(eq(swapRequests.id, swapId), eq(swapRequests.userId, req.authUser!.id)))
    .limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });

  const [created] = await db
    .insert(swapMessages)
    .values({
      swapRequestId: swapId,
      senderUserId: req.authUser!.id,
      senderRole: "customer",
      message,
    })
    .returning();

  res.status(201).json({ message: created });
});

apiRouter.post("/swaps/:id/pay-difference", requireAuth, async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const schema = z.object({
    paymentMethod: z.enum(["mtn_momo", "airtel_money", "card"]),
    payerPhone: z.string().max(25).optional(),
    idempotencyKey: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid payment details required." });

  const rows = await db
    .select()
    .from(swapRequests)
    .where(and(eq(swapRequests.id, swapId), eq(swapRequests.userId, req.authUser!.id)))
    .limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });

  const swap = rows[0];
  if (swap.status !== "awaiting_payment") {
    return res.status(400).json({ error: "Swap is not currently awaiting difference payment." });
  }

  const existingPay = await db
    .select()
    .from(payments)
    .where(eq(payments.idempotencyKey, parsed.data.idempotencyKey))
    .limit(1);
  if (existingPay.length > 0) {
    return res.json({ payment: existingPay[0], deduplicated: true });
  }

  const providerRef = `SWP-PAY-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const [created] = await db
    .insert(payments)
    .values({
      swapRequestId: swap.id,
      provider: `${parsed.data.paymentMethod}_sandbox`,
      providerRef,
      amountUgx: swap.payableDifferenceUgx,
      currency: "UGX",
      status: "pending",
      isSimulated: true,
      payerPhoneMasked: parsed.data.payerPhone ? maskPhone(parsed.data.payerPhone) : null,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    .returning();

  res.status(201).json({ payment: created, isSimulated: true });
});

// ==================== LEARN HUB & TIKTOK ====================
apiRouter.get("/learn/articles", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const conditions = [eq(articles.isPublished, true)];
  if (category && category !== "All") {
    conditions.push(eq(articles.category, category));
  }
  if (q) {
    conditions.push(or(ilike(articles.title, `%${q}%`), ilike(articles.summary, `%${q}%`))!);
  }
  const rows = await db.select().from(articles).where(and(...conditions)).orderBy(desc(articles.publishedAt));
  res.json({ articles: rows });
});

apiRouter.get("/learn/articles/:slug", async (req, res) => {
  const rows = await db.select().from(articles).where(eq(articles.slug, req.params.slug)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Article not found." });
  const article = rows[0];
  const relIds = article.relatedProductIds ?? [];
  const relatedProducts =
    relIds.length > 0 ? await hydrateProducts(await db.select().from(products).where(inArray(products.id, relIds))) : [];
  const allVideos = await db.select().from(tiktokVideos).where(eq(tiktokVideos.isAvailable, true));
  const relatedVideos = allVideos.filter((v) => (v.linkedArticleIds ?? []).includes(article.id));

  res.json({ article, relatedProducts, relatedVideos });
});

apiRouter.post("/learn/bookmarks/:articleId", requireAuth, async (req: AuthRequest, res) => {
  const articleId = Number(req.params.articleId);
  const existing = await db
    .select()
    .from(articleBookmarks)
    .where(and(eq(articleBookmarks.userId, req.authUser!.id), eq(articleBookmarks.articleId, articleId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(articleBookmarks).where(eq(articleBookmarks.id, existing[0].id));
    return res.json({ bookmarked: false, articleId });
  }
  await db.insert(articleBookmarks).values({ userId: req.authUser!.id, articleId });
  res.json({ bookmarked: true, articleId });
});

apiRouter.post("/learn/recommend", async (req, res) => {
  const schema = z.object({
    budgetUgx: z.number().int().positive(),
    preferredBrand: z.string().optional(),
    primaryUse: z.enum(["photography", "business", "gaming", "everyday"]),
    storageNeed: z.enum(["128GB", "256GB", "512GB"]),
    batteryPriority: z.enum(["high", "moderate"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Complete quiz inputs to generate recommendations." });

  const allProds = await hydrateProducts(await db.select().from(products).where(eq(products.isActive, true)));
  const smartphones = allProds.filter((p) => p.category?.slug !== "accessories" && p.totalAvailableStock > 0);

  const scored = smartphones
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];

      if (p.basePriceUgx <= parsed.data.budgetUgx) {
        score += 40;
        reasons.push(`Fits within your UGX ${parsed.data.budgetUgx.toLocaleString()} budget`);
      } else if (p.basePriceUgx <= parsed.data.budgetUgx * 1.15) {
        score += 15;
        reasons.push("Slightly above budget (eligible for phone swap discount)");
      } else {
        score -= 30;
      }

      if (parsed.data.preferredBrand && parsed.data.preferredBrand !== "Any" && p.brand?.name === parsed.data.preferredBrand) {
        score += 25;
        reasons.push(`Matches your preferred ${p.brand.name} ecosystem`);
      }

      if (parsed.data.primaryUse === "photography" && (p.specs.camera.includes("48MP") || p.specs.camera.includes("200MP") || p.specs.camera.includes("Telephoto"))) {
        score += 20;
        reasons.push(`Stabilized multi-lens camera (${p.specs.camera})`);
      } else if (parsed.data.primaryUse === "gaming" && (p.specs.display.includes("120Hz") || p.specs.display.includes("144Hz"))) {
        score += 20;
        reasons.push(`High-refresh ${p.specs.display} and ${p.specs.ram} RAM`);
      } else if (parsed.data.primaryUse === "business") {
        score += 15;
        reasons.push(`${p.warrantyMonths}-month warranty and reliable ${p.specs.sim}`);
      } else {
        score += 10;
        reasons.push(`Balanced everyday performance (${p.specs.processor})`);
      }

      if (p.variants.some((v) => v.storage.includes(parsed.data.storageNeed))) {
        score += 15;
        reasons.push(`Available in your target ${parsed.data.storageNeed} storage`);
      }

      if (parsed.data.batteryPriority === "high" && p.specs.battery.includes("5000")) {
        score += 15;
        reasons.push(`All-day 5000mAh+ battery capacity`);
      }

      return { product: p, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  res.json({ recommendations: scored });
});

apiRouter.get("/tiktok/videos", async (_req, res) => {
  const [videos, setting] = await Promise.all([
    db.select().from(tiktokVideos).where(eq(tiktokVideos.isAvailable, true)).orderBy(asc(tiktokVideos.displayOrder)),
    db.select().from(storeSettings).where(eq(storeSettings.key, "store_info")).limit(1),
  ]);
  res.json({
    profileUrl: (setting[0]?.value as any)?.tiktokUrl || "https://www.tiktok.com/@centurygadgets",
    videos,
  });
});

// ==================== NOTIFICATIONS, SUPPORT & UPLOADS ====================
apiRouter.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, req.authUser!.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  res.json({ notifications: rows });
});

apiRouter.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, Number(req.params.id)), eq(notifications.userId, req.authUser!.id)));
  res.json({ ok: true });
});

apiRouter.post("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.authUser!.id));
  res.json({ ok: true });
});

apiRouter.get("/support/config", async (_req, res) => {
  const setting = await db.select().from(storeSettings).where(eq(storeSettings.key, "store_info")).limit(1);
  res.json({
    storeInfo: setting[0]?.value ?? null,
    faqs: [
      {
        q: "Are all Century Gadgets smartphones unlocked for MTN and Airtel Uganda?",
        a: "Yes. Every brand-new and verified pre-owned smartphone we stock is factory-unlocked and tested on Ugandan 4G/5G networks.",
      },
      {
        q: "How does the Phone Swap valuation work?",
        a: "Your online quote is strictly provisional based on your description and photos. A technician confirms the final trade-in valuation after physical inspection in Kampala.",
      },
      {
        q: "Do you require my Apple ID or Google password during trade-in?",
        a: "Never. Do not submit device passcodes or account passwords online. You only remove Activation Lock in person after accepting the final confirmed offer.",
      },
      {
        q: "What warranty do used and refurbished phones include?",
        a: "Verified pre-owned devices carry a 6-month Century Gadgets hardware warranty; brand-new sealed devices carry a 12-month warranty.",
      },
    ],
  });
});

apiRouter.get("/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, req.authUser!.id))
    .orderBy(desc(supportTickets.createdAt));
  res.json({ tickets: rows });
});

apiRouter.post("/support/tickets", optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(7).max(25),
    subject: z.string().min(3).max(150),
    message: z.string().min(10).max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please complete all support fields." });

  const [created] = await db
    .insert(supportTickets)
    .values({
      userId: req.authUser?.id ?? null,
      ...parsed.data,
    })
    .returning();

  res.status(201).json({ ticket: created });
});

apiRouter.post("/uploads/image", requireAuth, async (req: AuthRequest, res) => {
  const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return res.status(400).json({ error: "Only valid PNG, JPEG, or WebP base64 images are permitted." });
  }
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 3 * 1024 * 1024) {
    return res.status(413).json({ error: "Image must be under 3MB." });
  }

  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `cg-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  res.status(201).json({ url: `/uploads/${filename}` });
});

// ==================== ADMIN & STAFF RBAC ====================
apiRouter.get("/admin/overview", requireAuth, requireRoles(...STAFF_ROLES), async (_req, res) => {
  const [allOrders, allSwaps, allVariants, allUsers, allTickets] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(swapRequests).orderBy(desc(swapRequests.createdAt)),
    db.select().from(productVariants),
    db.select({ id: users.id, role: users.role }).from(users),
    db.select().from(supportTickets).where(eq(supportTickets.status, "open")),
  ]);

  const paidOrders = allOrders.filter((o) => o.paymentStatus === "successful");
  const totalRevenueUgx = paidOrders.reduce((sum, o) => sum + o.totalUgx, 0);
  const pendingSwapsCount = allSwaps.filter((s) => !["completed", "cancelled", "offer_declined"].includes(s.status)).length;
  const lowStockCount = allVariants.filter((v) => v.stockQty - v.reservedQty <= 3).length;
  const totalAvailableUnits = allVariants.reduce((sum, v) => sum + Math.max(0, v.stockQty - v.reservedQty), 0);

  res.json({
    kpis: {
      totalRevenueUgx,
      totalOrders: allOrders.length,
      paidOrdersCount: paidOrders.length,
      pendingSwapsCount,
      lowStockCount,
      totalAvailableUnits,
      registeredUsersCount: allUsers.length,
      openSupportTickets: allTickets.length,
    },
    recentOrders: allOrders.slice(0, 8),
    recentSwaps: await hydrateSwaps(allSwaps.slice(0, 8)),
  });
});

// Admin Product & Inventory Management
apiRouter.get("/admin/products", requireAuth, requireRoles("inventory_manager"), async (_req, res) => {
  const all = await hydrateProducts(await db.select().from(products).orderBy(desc(products.createdAt)));
  res.json({ products: all });
});

apiRouter.post("/admin/products", requireAuth, requireRoles("inventory_manager"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(150),
    brandId: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    model: z.string().min(2).max(100),
    condition: z.enum(["new", "refurbished", "used"]),
    conditionGrade: z.string().min(2).max(80),
    batteryHealth: z.number().int().min(50).max(100).nullable().optional(),
    warrantyMonths: z.number().int().min(0).max(36),
    description: z.string().min(10).max(2000),
    basePriceUgx: z.number().int().positive(),
    storage: z.string().min(2).max(40),
    color: z.string().min(2).max(40),
    stockQty: z.number().int().min(0).max(1000),
    imageUrl: z.string().default("media:iphone"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid product fields", details: parsed.error.flatten() });

  const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomBytes(2).toString("hex")}`;
  const sku = `CG-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const created = await db.transaction(async (tx) => {
    const [prod] = await tx
      .insert(products)
      .values({
        name: parsed.data.name,
        slug,
        brandId: parsed.data.brandId,
        categoryId: parsed.data.categoryId,
        model: parsed.data.model,
        condition: parsed.data.condition,
        conditionGrade: parsed.data.conditionGrade,
        batteryHealth: parsed.data.batteryHealth ?? null,
        warrantyMonths: parsed.data.warrantyMonths,
        description: parsed.data.description,
        specs: {
          display: "Verified Factory Display",
          processor: "Standard Spec",
          ram: "Standard",
          camera: "Verified Camera Module",
          battery: "Tested Healthy",
          sim: "Unlocked",
          os: "Latest OS",
        },
        basePriceUgx: parsed.data.basePriceUgx,
        isSampleData: false,
      })
      .returning();

    const [variant] = await tx
      .insert(productVariants)
      .values({
        productId: prod.id,
        sku,
        storage: parsed.data.storage,
        color: parsed.data.color,
        priceUgx: parsed.data.basePriceUgx,
        stockQty: parsed.data.stockQty,
      })
      .returning();

    await tx.insert(productImages).values({
      productId: prod.id,
      url: parsed.data.imageUrl,
      altText: parsed.data.name,
      isPrimary: true,
    });

    await tx.insert(inventoryMovements).values({
      variantId: variant.id,
      deltaQty: parsed.data.stockQty,
      previousQty: 0,
      newQty: parsed.data.stockQty,
      reason: "New product created in admin console",
      referenceType: "manual_adjustment",
      referenceId: prod.slug,
      actorUserId: req.authUser!.id,
    });

    return prod;
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "product_created",
    entityType: "product",
    entityId: String(created.id),
    details: { name: created.name, priceUgx: created.basePriceUgx },
  });

  const [hydrated] = await hydrateProducts([created]);
  res.status(201).json({ product: hydrated });
});

apiRouter.post("/admin/variants/:id/stock", requireAuth, requireRoles("inventory_manager"), async (req: AuthRequest, res) => {
  const variantId = Number(req.params.id);
  const schema = z.object({
    newStockQty: z.number().int().min(0).max(5000),
    reason: z.string().min(5).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide valid stock quantity and audit reason (min 5 chars)." });

  const existing = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
  if (existing.length === 0) return res.status(404).json({ error: "Variant not found." });

  const prev = existing[0].stockQty;
  const [updated] = await db.transaction(async (tx) => {
    const resVar = await tx
      .update(productVariants)
      .set({ stockQty: parsed.data.newStockQty })
      .where(eq(productVariants.id, variantId))
      .returning();

    await tx.insert(inventoryMovements).values({
      variantId,
      deltaQty: parsed.data.newStockQty - prev,
      previousQty: prev,
      newQty: parsed.data.newStockQty,
      reason: parsed.data.reason,
      referenceType: "manual_adjustment",
      actorUserId: req.authUser!.id,
    });
    return resVar;
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "stock_adjusted",
    entityType: "product_variant",
    entityId: String(variantId),
    details: { prev, next: parsed.data.newStockQty, reason: parsed.data.reason },
  });

  res.json({ variant: updated });
});

apiRouter.patch("/admin/products/:id/archive", requireAuth, requireRoles("inventory_manager"), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const isActive = Boolean(req.body?.isActive);
  const [updated] = await db
    .update(products)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Product not found." });
  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: isActive ? "product_restored" : "product_archived",
    entityType: "product",
    entityId: String(id),
  });
  res.json({ product: updated });
});

// Admin Orders & Refunds
apiRouter.get("/admin/orders", requireAuth, requireRoles("order_manager"), async (_req, res) => {
  const all = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const ids = all.map((o) => o.id);
  const [items, payRows, refundRows] =
    ids.length > 0
      ? await Promise.all([
          db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
          db.select().from(payments).where(inArray(payments.orderId, ids)),
          db.select().from(refunds).where(inArray(refunds.orderId, ids)),
        ])
      : [[], [], []];

  res.json({
    orders: all.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
      payments: payRows.filter((p) => p.orderId === o.id),
      refunds: refundRows.filter((r) => r.orderId === o.id),
    })),
  });
});

apiRouter.patch("/admin/orders/:id/status", requireAuth, requireRoles("order_manager"), async (req: AuthRequest, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = typeof req.body?.status === "string" ? req.body.status : "";
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Order not found." });

  const order = rows[0];
  if (!isValidOrderTransition(order.status, nextStatus)) {
    return res.status(400).json({ error: `Transition from ${order.status} to ${nextStatus} is not permitted.` });
  }

  const [updated] = await db
    .update(orders)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();

  await db.insert(notifications).values({
    userId: order.userId,
    title: `Order ${order.orderRef} updated`,
    body: `Your order status is now: ${nextStatus.replace(/_/g, " ")}.`,
    category: "order",
    referenceType: "order",
    referenceId: order.orderRef,
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "order_status_updated",
    entityType: "order",
    entityId: order.orderRef,
    details: { from: order.status, to: nextStatus },
  });

  res.json({ order: updated });
});

apiRouter.post("/admin/orders/:id/refund", requireAuth, requireRoles("order_manager"), async (req: AuthRequest, res) => {
  const orderId = Number(req.params.id);
  const schema = z.object({
    reason: z.string().min(5).max(300),
    confirmApproval: z.literal(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Refund reason and explicit confirmation safeguard required." });

  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (orderRows.length === 0) return res.status(404).json({ error: "Order not found." });
  const order = orderRows[0];

  const payRows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "successful")))
    .limit(1);

  if (payRows.length === 0) {
    return res.status(400).json({ error: "Only successfully paid orders can be refunded." });
  }

  const result = await db.transaction(async (tx) => {
    const [refund] = await tx
      .insert(refunds)
      .values({
        orderId,
        paymentId: payRows[0].id,
        amountUgx: payRows[0].amountUgx,
        reason: parsed.data.reason,
        status: "processed",
        requestedByUserId: req.authUser!.id,
        approvedByUserId: req.authUser!.id,
        processedAt: new Date(),
      })
      .returning();

    await tx.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, payRows[0].id));
    await tx
      .update(orders)
      .set({ status: "refunded", paymentStatus: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await tx.insert(notifications).values({
      userId: order.userId,
      title: `Refund processed for ${order.orderRef}`,
      body: `Refund of UGX ${payRows[0].amountUgx.toLocaleString()} approved. Reason: ${parsed.data.reason}`,
      category: "payment",
      referenceType: "order",
      referenceId: order.orderRef,
    });

    return refund;
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "refund_approved",
    entityType: "order",
    entityId: order.orderRef,
    details: { amountUgx: result.amountUgx, reason: parsed.data.reason },
  });

  res.status(201).json({ refund: result });
});

// Admin Swap Assessment, Valuation & Inspection
apiRouter.get("/admin/swaps", requireAuth, requireRoles("swap_assessor"), async (_req, res) => {
  const rows = await db.select().from(swapRequests).orderBy(desc(swapRequests.createdAt));
  res.json({ swaps: await hydrateSwaps(rows) });
});

apiRouter.post("/admin/swaps/:id/assess", requireAuth, requireRoles("swap_assessor"), async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const schema = z.object({
    status: z.enum([
      "under_review",
      "more_info_required",
      "offer_issued",
      "awaiting_payment",
      "awaiting_exchange",
      "completed",
      "cancelled",
    ]),
    valuationUgx: z.number().int().min(0).optional(),
    note: z.string().min(3).max(400),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid assessment update." });

  const rows = await db.select().from(swapRequests).where(eq(swapRequests.id, swapId)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });
  const swap = rows[0];

  if (!isValidSwapTransition(swap.status, parsed.data.status)) {
    return res.status(400).json({ error: `Cannot transition swap from ${swap.status} to ${parsed.data.status}.` });
  }

  await db.transaction(async (tx) => {
    let offeredValuationUgx = swap.offeredValuationUgx;
    let payableDifferenceUgx = swap.payableDifferenceUgx;

    if (parsed.data.valuationUgx !== undefined) {
      offeredValuationUgx = parsed.data.valuationUgx;
      payableDifferenceUgx = calculateSwapDifference(swap.targetPriceUgx, offeredValuationUgx);
      await tx.insert(swapValuations).values({
        swapRequestId: swap.id,
        stage: parsed.data.status === "offer_issued" ? "initial_offer" : "post_inspection_revised",
        amountUgx: offeredValuationUgx,
        payableDifferenceUgx,
        notes: parsed.data.note,
        actorUserId: req.authUser!.id,
        customerDecision: "pending",
      });
    }

    await tx
      .update(swapRequests)
      .set({
        status: parsed.data.status,
        offeredValuationUgx,
        payableDifferenceUgx,
        staffNotes: parsed.data.note,
        updatedAt: new Date(),
      })
      .where(eq(swapRequests.id, swap.id));

    await tx.insert(swapStatusHistory).values({
      swapRequestId: swap.id,
      fromStatus: swap.status,
      toStatus: parsed.data.status,
      note: parsed.data.note,
      actorUserId: req.authUser!.id,
    });

    await tx.insert(notifications).values({
      userId: swap.userId,
      title: `Swap ${swap.swapRef} update: ${parsed.data.status.replace(/_/g, " ")}`,
      body:
        parsed.data.valuationUgx !== undefined
          ? `Assessed valuation: UGX ${parsed.data.valuationUgx.toLocaleString()}. Payable balance: UGX ${payableDifferenceUgx.toLocaleString()}.`
          : parsed.data.note,
      category: "swap",
      referenceType: "swap",
      referenceId: swap.swapRef,
    });
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "swap_assessed",
    entityType: "swap_request",
    entityId: swap.swapRef,
    details: parsed.data,
  });

  const updated = await db.select().from(swapRequests).where(eq(swapRequests.id, swap.id));
  const [hydrated] = await hydrateSwaps(updated);
  res.json({ swap: hydrated });
});

apiRouter.post("/admin/swaps/:id/inspect", requireAuth, requireRoles("swap_assessor"), async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const schema = z.object({
    finalValuationUgx: z.number().int().min(0),
    inspectionNotes: z.string().min(4).max(500),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Final valuation and inspection notes required." });

  const rows = await db.select().from(swapRequests).where(eq(swapRequests.id, swapId)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "Swap request not found." });
  const swap = rows[0];

  const payableDifferenceUgx = calculateSwapDifference(swap.targetPriceUgx, parsed.data.finalValuationUgx);
  const valuationChanged =
    swap.offeredValuationUgx !== null && swap.offeredValuationUgx !== parsed.data.finalValuationUgx;

  // Rule: Require customer approval of any revised offer before completion
  const nextStatus = valuationChanged
    ? "offer_issued"
    : payableDifferenceUgx > 0
      ? "awaiting_payment"
      : "awaiting_exchange";

  await db.transaction(async (tx) => {
    await tx
      .update(inspectionAppointments)
      .set({
        status: "completed",
        inspectorUserId: req.authUser!.id,
        inspectionNotes: parsed.data.inspectionNotes,
        updatedAt: new Date(),
      })
      .where(eq(inspectionAppointments.swapRequestId, swap.id));

    await tx.insert(swapValuations).values({
      swapRequestId: swap.id,
      stage: valuationChanged ? "post_inspection_revised" : "final_confirmed",
      amountUgx: parsed.data.finalValuationUgx,
      payableDifferenceUgx,
      notes: parsed.data.inspectionNotes,
      actorUserId: req.authUser!.id,
      customerDecision: valuationChanged ? "pending" : "accepted",
      customerDecisionAt: valuationChanged ? null : new Date(),
    });

    await tx
      .update(swapRequests)
      .set({
        status: nextStatus,
        finalConfirmedValuationUgx: parsed.data.finalValuationUgx,
        payableDifferenceUgx,
        staffNotes: parsed.data.inspectionNotes,
        updatedAt: new Date(),
      })
      .where(eq(swapRequests.id, swap.id));

    await tx.insert(swapStatusHistory).values({
      swapRequestId: swap.id,
      fromStatus: swap.status,
      toStatus: nextStatus,
      note: valuationChanged
        ? `Physical inspection complete. Valuation revised to UGX ${parsed.data.finalValuationUgx.toLocaleString()} (awaiting customer approval).`
        : `Physical inspection confirmed valuation at UGX ${parsed.data.finalValuationUgx.toLocaleString()}.`,
      actorUserId: req.authUser!.id,
    });

    await tx.insert(notifications).values({
      userId: swap.userId,
      title: `Inspection completed for ${swap.swapRef}`,
      body: valuationChanged
        ? `Revised post-inspection valuation: UGX ${parsed.data.finalValuationUgx.toLocaleString()}. Please accept or decline.`
        : `Inspection verified! Payable balance: UGX ${payableDifferenceUgx.toLocaleString()}.`,
      category: "swap",
      referenceType: "swap",
      referenceId: swap.swapRef,
    });
  });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "swap_inspection_completed",
    entityType: "swap_request",
    entityId: swap.swapRef,
    details: { finalValuationUgx: parsed.data.finalValuationUgx, valuationChanged },
  });

  const updated = await db.select().from(swapRequests).where(eq(swapRequests.id, swap.id));
  const [hydrated] = await hydrateSwaps(updated);
  res.json({ swap: hydrated });
});

apiRouter.post("/admin/swaps/:id/messages", requireAuth, requireRoles("swap_assessor"), async (req: AuthRequest, res) => {
  const swapId = Number(req.params.id);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length < 2) return res.status(400).json({ error: "Message cannot be empty." });

  const [created] = await db
    .insert(swapMessages)
    .values({
      swapRequestId: swapId,
      senderUserId: req.authUser!.id,
      senderRole: "staff",
      message,
    })
    .returning();

  res.status(201).json({ message: created });
});

// Admin Content, TikTok, Discounts, Zones, Staff, Audit Logs, CSV Export
apiRouter.post("/admin/articles", requireAuth, requireRoles("content_editor"), async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(5).max(180),
    category: z.string().min(3).max(80),
    summary: z.string().min(10).max(400),
    contentMarkdown: z.string().min(20),
    readingTimeMin: z.number().int().min(1).max(30).default(4),
    tags: z.array(z.string()).default([]),
    coverImageUrl: z.string().default("media:learn"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid article fields." });

  const slug = `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomBytes(2).toString("hex")}`;
  const [created] = await db
    .insert(articles)
    .values({
      ...parsed.data,
      slug,
      authorName: req.authUser!.fullName,
      isSampleData: false,
    })
    .returning();

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "article_published",
    entityType: "article",
    entityId: created.slug,
  });

  res.status(201).json({ article: created });
});

apiRouter.post("/admin/tiktok", requireAuth, requireRoles("content_editor"), async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(4).max(150),
    description: z.string().min(5).max(400),
    videoUrl: z.string().url(),
    category: z.string().min(2).max(60),
    thumbnailUrl: z.string().default("media:learn"),
    linkedProductIds: z.array(z.number().int()).default([]),
    displayOrder: z.number().int().default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid TikTok video fields." });

  const [created] = await db
    .insert(tiktokVideos)
    .values({ ...parsed.data, isSampleData: false })
    .returning();

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "tiktok_video_added",
    entityType: "tiktok_video",
    entityId: String(created.id),
  });

  res.status(201).json({ video: created });
});

apiRouter.delete("/admin/tiktok/:id", requireAuth, requireRoles("content_editor"), async (req: AuthRequest, res) => {
  await db.delete(tiktokVideos).where(eq(tiktokVideos.id, Number(req.params.id)));
  res.json({ deleted: true });
});

apiRouter.get("/admin/staff", requireAuth, requireRoles("administrator"), async (_req, res) => {
  const all = await db.select().from(users).orderBy(desc(users.createdAt));
  res.json({ users: all.map(mapDbUser) });
});

apiRouter.patch("/admin/staff/:id/role", requireAuth, requireRoles("administrator"), async (req: AuthRequest, res) => {
  const roleSchema = z.object({
    role: z.enum(["customer", "administrator", "inventory_manager", "order_manager", "swap_assessor", "content_editor"]),
  });
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid role." });

  const targetId = Number(req.params.id);
  const [updated] = await db
    .update(users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(users.id, targetId))
    .returning();

  if (!updated) return res.status(404).json({ error: "User not found." });

  await logAudit({
    actorUserId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: "user_role_updated",
    entityType: "user",
    entityId: String(targetId),
    details: { role: parsed.data.role },
  });

  res.json({ user: mapDbUser(updated) });
});

apiRouter.get("/admin/audit-logs", requireAuth, requireRoles("administrator"), async (_req, res) => {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  res.json({ logs });
});

apiRouter.get("/admin/reviews", requireAuth, requireRoles("content_editor"), async (_req, res) => {
  const rows = await db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(50);
  res.json({ reviews: rows });
});

apiRouter.patch("/admin/reviews/:id", requireAuth, requireRoles("content_editor"), async (req: AuthRequest, res) => {
  const [updated] = await db
    .update(reviews)
    .set({ isApproved: Boolean(req.body?.isApproved) })
    .where(eq(reviews.id, Number(req.params.id)))
    .returning();
  res.json({ review: updated });
});

apiRouter.get("/admin/reports/orders.csv", requireAuth, requireRoles(...STAFF_ROLES), async (_req, res: Response) => {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const header = "order_ref,status,payment_status,payment_method,subtotal_ugx,discount_ugx,delivery_fee_ugx,total_ugx,customer_name,created_at\n";
  const body = rows
    .map((r) =>
      [
        r.orderRef,
        r.status,
        r.paymentStatus,
        r.paymentMethod,
        r.subtotalUgx,
        r.discountUgx,
        r.deliveryFeeUgx,
        r.totalUgx,
        `"${r.customerName.replace(/"/g, '""')}"`,
        r.createdAt.toISOString(),
      ].join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=century-gadgets-orders.csv");
  res.send(header + body);
});
