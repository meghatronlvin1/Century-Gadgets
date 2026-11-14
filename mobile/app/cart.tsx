import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { formatUgx, mobileApi } from "../../src/lib/api";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function CartScreen() {
  const { data } = useQuery({
    queryKey: ["cart"],
    queryFn: () => mobileApi<any>("/cart"),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={Typography.h1}>Shopping Cart</Text>
      {(data?.items || []).map((item: any) => (
        <View key={item.variantId} style={styles.row}>
          <Text style={Typography.body}>{item.quantity}x {item.productName} ({item.storage})</Text>
          <Text style={[Typography.body, { fontWeight: "700" }]}>{formatUgx(item.lineTotalUgx)}</Text>
        </View>
      ))}
      <View style={styles.totalBox}>
        <Text style={Typography.h2}>Subtotal</Text>
        <Text style={Typography.h2}>{formatUgx(data?.subtotalUgx || 0)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  row: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalBox: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
