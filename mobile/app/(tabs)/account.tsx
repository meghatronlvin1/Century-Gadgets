import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileApi } from "../../src/lib/api";
import { useAppStore } from "../../src/store/useAppStore";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

export default function AccountScreen() {
  const { accessToken, userEmail, userName, setSession, clearSession } = useAppStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await mobileApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      await setSession(res.accessToken, res.refreshToken, res.user.email, res.user.fullName);
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      {accessToken ? (
        <View style={styles.card}>
          <Text style={Typography.h1}>{userName || "Customer"}</Text>
          <Text style={Typography.caption}>{userEmail}</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: Spacing.lg }]} onPress={clearSession}>
            <Text style={styles.primaryBtnText}>Sign Out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={Typography.h1}>Sign In</Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email or Phone (+256...)"
            style={[styles.input, { marginTop: Spacing.md }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            style={styles.input}
          />
          <Pressable style={styles.primaryBtn} onPress={handleLogin}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </Pressable>
        </View>
      )}
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
  },
  input: {
    backgroundColor: Colors.lightBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryNavy,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.white, fontWeight: "600" },
});
