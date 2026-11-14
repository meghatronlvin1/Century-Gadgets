import React from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatUgx, mobileApi } from "../../src/lib/api";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => mobileApi<any>("/catalog/bootstrap"),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primaryNavy} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={Typography.body}>Unable to reach Century Gadgets server.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Kampala Flagship · UGX Verified</Text>
        <Text style={styles.heroTitle}>Verified smartphones & transparent phone swaps.</Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/shop")}>
            <Text style={styles.primaryBtnText}>Browse Shop</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push("/(tabs)/swap")}>
            <Text style={styles.secondaryBtnText}>Swap Phone</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[Typography.h2, { marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
        Best-Selling Devices
      </Text>

      <FlatList
        scrollEnabled={false}
        data={data.bestSellers || []}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/product/${item.slug}`)}
            style={styles.productCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={Typography.caption}>
                {item.brand?.name} · {item.conditionGrade}
              </Text>
              <Text style={[Typography.h2, { fontSize: 16, marginTop: 2 }]}>{item.name}</Text>
              <Text style={[Typography.body, { fontWeight: "700", marginTop: 6 }]}>
                {formatUgx(item.basePriceUgx)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.lightBackground },
  heroCard: {
    backgroundColor: Colors.primaryNavy,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
  },
  heroKicker: { color: "#CBD5E1", fontSize: 12 },
  heroTitle: { color: Colors.white, fontSize: 22, fontWeight: "700", marginTop: 8, lineHeight: 28 },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  primaryBtn: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.md },
  primaryBtnText: { color: Colors.primaryNavy, fontWeight: "600", fontSize: 13 },
  secondaryBtn: { borderWidth: 1, borderColor: "#475569", paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.md },
  secondaryBtnText: { color: Colors.white, fontWeight: "600", fontSize: 13 },
  productCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
