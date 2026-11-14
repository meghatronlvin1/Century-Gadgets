import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth, googleAuthProvider } from "../lib/firebase.ts";
import { apiRequest, setApiAuthToken } from "../lib/api.ts";
import type {
  ArticleRecord,
  CartState,
  DeliveryZone,
  Product,
  StoreInfo,
  TikTokVideoRecord,
  UserProfile,
} from "../types.ts";

interface BootstrapData {
  brands: Array<{ id: number; name: string; slug: string }>;
  categories: Array<{ id: number; name: string; slug: string; description: string }>;
  deliveryZones: DeliveryZone[];
  featuredProducts: Product[];
  bestSellers: Product[];
  recentProducts: Product[];
  recommendedProducts: Product[];
  allProducts: Product[];
  learnArticles: ArticleRecord[];
  tiktokVideos: TikTokVideoRecord[];
  storeInfo: StoreInfo | null;
}

interface AppContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  bootstrap: BootstrapData | null;
  bootstrapLoading: boolean;
  cart: CartState | null;
  wishlistIds: number[];
  bookmarkIds: number[];
  unreadNotifications: number;
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (message: string, type?: "success" | "error") => void;
  signInWithGoogle: () => Promise<void>;
  signInWithCredentials: (identifier: string, password: string) => Promise<void>;
  registerAccount: (fullName: string, email: string, phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  refreshCart: (zoneId?: number) => Promise<void>;
  refreshUserSync: () => Promise<void>;
  addToCart: (variantId: number, quantity?: number) => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  toggleBookmark: (articleId: number) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [cart, setCart] = useState<CartState | null>(null);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<number[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3600);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    try {
      const data = await apiRequest<BootstrapData>("/catalog/bootstrap");
      setBootstrap(data);
    } catch (err: any) {
      showToast(err.message || "Unable to load catalogue", "error");
    } finally {
      setBootstrapLoading(false);
    }
  }, [showToast]);

  const refreshCart = useCallback(async (zoneId?: number) => {
    try {
      const data = await apiRequest<CartState>(`/cart${zoneId ? `?deliveryZoneId=${zoneId}` : ""}`);
      setCart(data);
    } catch {
      // silent fallback
    }
  }, []);

  const refreshUserSync = useCallback(async () => {
    try {
      const synced = await apiRequest<{
        user: UserProfile;
        wishlistProductIds: number[];
        bookmarkedArticleIds: number[];
        unreadNotificationCount: number;
      }>("/auth/sync", { method: "POST" });
      setUser(synced.user);
      setWishlistIds(synced.wishlistProductIds);
      setBookmarkIds(synced.bookmarkedArticleIds);
      setUnreadNotifications(synced.unreadNotificationCount);
      await refreshCart();
    } catch {
      setUser(null);
    }
  }, [refreshCart]);

  useEffect(() => {
    refreshBootstrap();
    refreshCart();
  }, [refreshBootstrap, refreshCart]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setApiAuthToken(token);
        await refreshUserSync();
      } else {
        // Keep email/phone token if active; otherwise clear
        setAuthLoading(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [refreshUserSync]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setApiAuthToken(token);
      await refreshUserSync();
      await refreshBootstrap();
      showToast("Signed in to Century Gadgets");
    } catch (err: any) {
      showToast(err.message || "Google sign-in cancelled", "error");
    }
  }, [refreshUserSync, refreshBootstrap, showToast]);

  const signInWithCredentials = useCallback(
    async (identifier: string, password: string) => {
      const res = await apiRequest<{ user: UserProfile; accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      setApiAuthToken(res.accessToken);
      await refreshUserSync();
      showToast(`Welcome back, ${res.user.fullName}`);
    },
    [refreshUserSync, showToast]
  );

  const registerAccount = useCallback(
    async (fullName: string, email: string, phone: string, password: string) => {
      const res = await apiRequest<{ user: UserProfile; accessToken: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, phone, password }),
      });
      setApiAuthToken(res.accessToken);
      await refreshUserSync();
      showToast("Account created and signed in");
    },
    [refreshUserSync, showToast]
  );

  const signOut = useCallback(async () => {
    setApiAuthToken(null);
    await firebaseSignOut(auth).catch(() => {});
    setUser(null);
    setWishlistIds([]);
    setBookmarkIds([]);
    setUnreadNotifications(0);
    await refreshCart();
    showToast("Signed out");
  }, [refreshCart, showToast]);

  const addToCart = useCallback(
    async (variantId: number, quantity = 1) => {
      try {
        const updated = await apiRequest<CartState>("/cart/items", {
          method: "POST",
          body: JSON.stringify({ variantId, quantity }),
        });
        setCart(updated);
        showToast("Added to shopping cart");
      } catch (err: any) {
        showToast(err.message || "Could not add item", "error");
      }
    },
    [showToast]
  );

  const toggleWishlist = useCallback(
    async (productId: number) => {
      if (!user) {
        showToast("Sign in on the Account tab to save wishlist items", "error");
        return;
      }
      try {
        const res = await apiRequest<{ saved: boolean; productId: number }>(`/catalog/wishlist/${productId}`, {
          method: "POST",
        });
        setWishlistIds((prev) =>
          res.saved ? [...new Set([...prev, productId])] : prev.filter((id) => id !== productId)
        );
        showToast(res.saved ? "Saved to wishlist" : "Removed from wishlist");
      } catch (err: any) {
        showToast(err.message, "error");
      }
    },
    [user, showToast]
  );

  const toggleBookmark = useCallback(
    async (articleId: number) => {
      if (!user) {
        showToast("Sign in to bookmark educational articles", "error");
        return;
      }
      try {
        const res = await apiRequest<{ bookmarked: boolean; articleId: number }>(`/learn/bookmarks/${articleId}`, {
          method: "POST",
        });
        setBookmarkIds((prev) =>
          res.bookmarked ? [...new Set([...prev, articleId])] : prev.filter((id) => id !== articleId)
        );
        showToast(res.bookmarked ? "Article bookmarked" : "Bookmark removed");
      } catch (err: any) {
        showToast(err.message, "error");
      }
    },
    [user, showToast]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        bootstrap,
        bootstrapLoading,
        cart,
        wishlistIds,
        bookmarkIds,
        unreadNotifications,
        toast,
        showToast,
        signInWithGoogle,
        signInWithCredentials,
        registerAccount,
        signOut,
        refreshBootstrap,
        refreshCart,
        refreshUserSync,
        addToCart,
        toggleWishlist,
        toggleBookmark,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
