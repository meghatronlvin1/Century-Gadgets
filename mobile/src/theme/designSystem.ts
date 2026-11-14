export const Colors = {
  primaryNavy: "#102747",
  white: "#FFFFFF",
  lightBackground: "#F5F7FA",
  secondaryText: "#667085",
  border: "#E3E8EF",
  success: "#16A34A",
  error: "#DC2626",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const Typography = {
  h1: { fontSize: 24, fontWeight: "700" as const, color: Colors.primaryNavy },
  h2: { fontSize: 18, fontWeight: "700" as const, color: Colors.primaryNavy },
  body: { fontSize: 14, fontWeight: "400" as const, color: Colors.primaryNavy },
  caption: { fontSize: 12, fontWeight: "400" as const, color: Colors.secondaryText },
} as const;
