import React from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { ArrowLeftRight, BookOpen, Home, ShoppingBag, ShoppingCart, User } from "lucide-react-native";
import { useAppStore } from "../../src/store/useAppStore";
import { Colors } from "../../src/theme/designSystem";

export default function TabsLayout() {
  const router = useRouter();
  const cartCount = useAppStore((s) => s.cartCount);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primaryNavy,
        tabBarInactiveTintColor: Colors.secondaryText,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: 62,
          paddingBottom: 6,
        },
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primaryNavy,
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/cart")}
            accessibilityLabel="Open shopping cart"
            style={{
              marginRight: 16,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: Colors.primaryNavy,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              gap: 6,
            }}
          >
            <ShoppingCart size={16} color={Colors.white} />
            <Text style={{ color: Colors.white, fontSize: 12, fontWeight: "600" }}>{cartCount}</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Century Gadgets",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarLabel: "Shop",
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title: "Phone Swap",
          tabBarLabel: "Swap",
          tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn Hub",
          tabBarLabel: "Learn",
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarLabel: "Account",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
