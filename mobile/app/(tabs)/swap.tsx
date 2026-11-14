import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as ImagePicker from "expo-image-picker";
import { z } from "zod";
import { mobileApi } from "../../src/lib/api";
import { Colors, Radii, Spacing, Typography } from "../../src/theme/designSystem";

const swapSchema = z.object({
  currentBrand: z.string().min(2),
  currentModel: z.string().min(2),
  currentStorage: z.string().min(2),
  currentColor: z.string().min(2),
  batteryCondition: z.string().min(2),
  cameraCondition: z.string().min(2),
  powersOn: z.boolean(),
  hasBeenRepaired: z.boolean(),
});

type SwapFormValues = z.infer<typeof swapSchema>;

export default function SwapScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<SwapFormValues>({
    resolver: zodResolver(swapSchema),
    defaultValues: {
      currentBrand: "Apple",
      currentModel: "",
      currentStorage: "128GB",
      currentColor: "Space Gray",
      batteryCondition: "88% Health",
      cameraCondition: "Working",
      powersOn: true,
      hasBeenRepaired: false,
    },
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const uploaded = await mobileApi<{ url: string }>("/uploads/image", {
        method: "POST",
        body: JSON.stringify({ dataUrl: `data:image/jpeg;base64,${result.assets[0].base64}` }),
      });
      setPhotoUri(uploaded.url);
    }
  };

  const onSubmit = async (values: SwapFormValues) => {
    if (!photoUri) {
      Alert.alert("Photo Required", "Please attach at least one device photo.");
      return;
    }
    try {
      await mobileApi("/swaps", {
        method: "POST",
        body: JSON.stringify({
          targetProductId: 1,
          targetVariantId: 1,
          ...values,
          physicalCondition: "good",
          screenCondition: "flawless",
          includesBoxOrAccessories: "Phone + Box",
          ownershipDeclared: true,
          photos: [{ angleLabel: "front", url: photoUri }],
        }),
      });
      Alert.alert("Submitted", "Your swap request has been submitted for staff review.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={Typography.h1}>Phone Swap Assessment</Text>
      <Text style={[Typography.caption, { marginTop: 4, marginBottom: Spacing.lg }]}>
        Submit your device details and photos. Online quotes are provisional pending Kampala inspection.
      </Text>

      <Controller
        control={control}
        name="currentModel"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Current phone model (e.g. iPhone 13 Pro)"
            style={styles.input}
          />
        )}
      />

      <Controller
        control={control}
        name="powersOn"
        render={({ field: { onChange, value } }) => (
          <View style={styles.switchRow}>
            <Text style={Typography.body}>Powers on normally</Text>
            <Switch value={value} onValueChange={onChange} />
          </View>
        )}
      />

      <Pressable style={styles.secondaryBtn} onPress={pickPhoto}>
        <Text style={styles.secondaryBtnText}>
          {photoUri ? "Device Photo Attached" : "Upload Device Photo"}
        </Text>
      </Pressable>

      <Pressable style={styles.primaryBtn} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.primaryBtnText}>Submit Swap Request</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBackground },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: Spacing.md,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.primaryNavy,
    borderRadius: Radii.md,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  secondaryBtnText: { color: Colors.primaryNavy, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: Colors.primaryNavy,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.white, fontWeight: "600" },
});
