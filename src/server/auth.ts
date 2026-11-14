import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { adminAuth, firebaseConfig } from "../lib/firebase-admin.ts";
import { db } from "../db/index.ts";
import { users, type UserRole } from "../db/schema.ts";

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  notificationPrefs: {
    orders: boolean;
    swaps: boolean;
    learn: boolean;
    promotions: boolean;
  };
  preferredBrands: string[];
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

const TOKEN_SECRET =
  process.env.APP_TOKEN_SECRET || `century-gadgets-${firebaseConfig.projectId}-${firebaseConfig.apiKey}`;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

interface TokenPayload {
  uid: string;
  email: string;
  type: "access" | "refresh";
  exp: number;
}

export function signAppToken(uid: string, email: string, type: "access" | "refresh" = "access"): string {
  const ttlMs = type === "access" ? 1000 * 60 * 60 * 4 : 1000 * 60 * 60 * 24 * 14;
  const payload: TokenPayload = {
    uid,
    email,
    type,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  return `cg.${encoded}.${sig}`;
}

export function verifyAppToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "cg") return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isOwnerEmail(email: string): boolean {
  const ownerEmail = (process.env.CENTURY_OWNER_EMAIL || "kiwalabyemarkalvin@gmail.com").toLowerCase();
  return email.toLowerCase() === ownerEmail;
}

export async function upsertFirebaseUser(params: {
  uid: string;
  email: string;
  fullName?: string;
  emailVerified?: boolean;
}): Promise<AuthenticatedUser> {
  const defaultRole: UserRole = isOwnerEmail(params.email) ? "administrator" : "customer";
  const existing = await db.select().from(users).where(eq(users.uid, params.uid)).limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const shouldPromoteOwner = isOwnerEmail(params.email) && current.role === "customer";
    if (shouldPromoteOwner || current.email !== params.email) {
      const [updated] = await db
        .update(users)
        .set({
          email: params.email,
          role: shouldPromoteOwner ? "administrator" : current.role,
          emailVerified: params.emailVerified ?? current.emailVerified,
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return mapDbUser(updated);
    }
    return mapDbUser(current);
  }

  // Also check if user registered earlier with same email
  const byEmail = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (byEmail.length > 0) {
    const [updated] = await db
      .update(users)
      .set({
        uid: params.uid,
        role: isOwnerEmail(params.email) ? "administrator" : byEmail[0].role,
        emailVerified: params.emailVerified ?? byEmail[0].emailVerified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail[0].id))
      .returning();
    return mapDbUser(updated);
  }

  const [inserted] = await db
    .insert(users)
    .values({
      uid: params.uid,
      email: params.email,
      fullName: params.fullName || params.email.split("@")[0],
      role: defaultRole,
      emailVerified: params.emailVerified ?? false,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: params.email,
        updatedAt: new Date(),
      },
    })
    .returning();

  return mapDbUser(inserted);
}

export function mapDbUser(row: typeof users.$inferSelect): AuthenticatedUser {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    phone: row.phone,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    emailVerified: row.emailVerified,
    phoneVerified: row.phoneVerified,
    notificationPrefs: row.notificationPrefs,
    preferredBrands: row.preferredBrands,
  };
}

async function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // 1. Check signed app token (for email/phone & mobile client flows)
  if (token.startsWith("cg.")) {
    const payload = verifyAppToken(token);
    if (!payload || payload.type !== "access") return null;
    const rows = await db.select().from(users).where(eq(users.uid, payload.uid)).limit(1);
    if (rows.length === 0 || !rows[0].isActive) return null;
    return mapDbUser(rows[0]);
  }

  // 2. Verify Firebase ID Token
  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email || `${decoded.uid}@centurygadgets.ug`;
  return upsertFirebaseUser({
    uid: decoded.uid,
    email,
    fullName: decoded.name || email.split("@")[0],
    emailVerified: Boolean(decoded.email_verified),
  });
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required. Please sign in." });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated." });
    }
    req.authUser = user;
    next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.authUser = (await resolveAuthUser(req)) ?? undefined;
  } catch {
    req.authUser = undefined;
  }
  next();
};

export const STAFF_ROLES: UserRole[] = [
  "administrator",
  "inventory_manager",
  "order_manager",
  "swap_assessor",
  "content_editor",
];

export function requireRoles(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.authUser.role === "administrator" || allowed.includes(req.authUser.role)) {
      return next();
    }
    return res.status(403).json({ error: "Insufficient role permissions for this operation." });
  };
}
