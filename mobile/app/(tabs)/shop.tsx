import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatUgx, mobileApi } from "../../src/lib/api";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function ShopScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["products", search],
    queryFn: () => mobileApi<any>(`/catalog/products?q=${encodeURIComponent(search)}`),
  });

  return (
    <View style={styles.container}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search iPhone, Samsung, Tecno, Pixel..."
        placeholderTextColor={Colors.secondaryText}
        style={styles.searchInput}
      />
      <FlatList
        data={data?.items || []}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.lg }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/product/${item.slug}`)}
            style={styles.card}
          >
            <Text style={Typography.caption}>{item.brand?.name} · {item.condition}</Text>
            <Text style={[Typography.h2, { fontSize: 16, marginTop: 2 }]}>{item.name}</Text>
            <Text style={[Typography.body, { fontWeight: "700", marginTop: 6 }]}>
              {formatUgx(item.basePriceUgx)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  searchInput: {
    margin: Spacing.lg,
    marginBottom: 0,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.primaryNavy,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
