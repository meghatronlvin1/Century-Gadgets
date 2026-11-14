import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { formatUgx, mobileApi } from "../../src/lib/api";
import { useAppStore } from "../../src/store/useAppStore";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const setCartCount = useAppStore((s) => s.setCartCount);
  const { data } = useQuery({
    queryKey: ["product", id],
    queryFn: () => mobileApi<any>(`/catalog/products/${id}`),
  });

  const product = data?.product;
  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={Typography.body}>Loading device details...</Text>
      </View>
    );
  }

  const addToCart = async () => {
    try {
      const updated = await mobileApi<any>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ variantId: product.variants[0]?.id, quantity: 1 }),
      });
      setCartCount(updated.itemCount);
      Alert.alert("Added", "Device added to your cart.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={Typography.caption}>{product.brand?.name} · {product.conditionGrade}</Text>
      <Text style={[Typography.h1, { marginTop: 4 }]}>{product.name}</Text>
      <Text style={[Typography.h2, { marginTop: 8 }]}>{formatUgx(product.basePriceUgx)}</Text>
      <Text style={[Typography.body, { marginTop: 12, lineHeight: 20 }]}>{product.description}</Text>

      <Pressable style={[styles.primaryBtn, { marginTop: Spacing.xl }]} onPress={addToCart}>
        <Text style={styles.primaryBtnText}>Add to Cart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: Colors.primaryNavy, borderRadius: Radii.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: Colors.white, fontWeight: "600" },
});
