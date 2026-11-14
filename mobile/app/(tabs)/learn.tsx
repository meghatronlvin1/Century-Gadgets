import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { mobileApi } from "../../src/lib/api";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function LearnScreen() {
  const { data: artData } = useQuery({
    queryKey: ["articles"],
    queryFn: () => mobileApi<any>("/learn/articles"),
  });
  const { data: tiktokData } = useQuery({
    queryKey: ["tiktok"],
    queryFn: () => mobileApi<any>("/tiktok/videos"),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={Typography.h1}>Learn Before You Buy</Text>
      <Text style={[Typography.caption, { marginBottom: Spacing.lg }]}>
        Guides & Century Gadgets official TikTok tutorials
      </Text>

      {(artData?.articles || []).map((art: any) => (
        <View key={art.id} style={styles.card}>
          <Text style={Typography.caption}>{art.category} · {art.readingTimeMin} min read</Text>
          <Text style={[Typography.h2, { fontSize: 16, marginTop: 4 }]}>{art.title}</Text>
          <Text style={[Typography.caption, { marginTop: 4 }]}>{art.summary}</Text>
        </View>
      ))}

      <Pressable
        style={styles.primaryBtn}
        onPress={() => Linking.openURL(tiktokData?.profileUrl || "https://www.tiktok.com/@centurygadgets")}
      >
        <Text style={styles.primaryBtnText}>Follow Century Gadgets on TikTok</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryNavy,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.white, fontWeight: "600" },
});
