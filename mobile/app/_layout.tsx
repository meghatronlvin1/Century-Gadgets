import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAppStore } from "../src/store/useAppStore";
import { Colors } from "../src/theme/designSystem";

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const hydrateSession = useAppStore((s) => s.hydrateSession);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.primaryNavy,
          contentStyle: { backgroundColor: Colors.lightBackground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: "Device Details" }} />
        <Stack.Screen name="cart" options={{ title: "Cart & Checkout" }} />
      </Stack>
    </QueryClientProvider>
  );
}
