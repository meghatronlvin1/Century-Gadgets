import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const ACCESS_TOKEN_KEY = "cg_access_token";
const REFRESH_TOKEN_KEY = "cg_refresh_token";

interface MobileAppState {
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
  cartCount: number;
  hydrateSession: () => Promise<void>;
  setSession: (accessToken: string, refreshToken: string, email: string, name: string) => Promise<void>;
  clearSession: () => Promise<void>;
  setCartCount: (count: number) => void;
}

export const useAppStore = create<MobileAppState>((set) => ({
  accessToken: null,
  userEmail: null,
  userName: null,
  cartCount: 0,
  hydrateSession: async () => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) set({ accessToken: token });
  },
  setSession: async (accessToken, refreshToken, email, name) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, userEmail: email, userName: name });
  },
  clearSession: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ accessToken: null, userEmail: null, userName: null });
  },
  setCartCount: (cartCount) => set({ cartCount }),
}));
