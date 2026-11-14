export type UserRole =
  | "customer"
  | "administrator"
  | "inventory_manager"
  | "order_manager"
  | "swap_assessor"
  | "content_editor";

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  notificationPrefs: {
    orders: boolean;
    swaps: boolean;
    learn: boolean;
    promotions: boolean;
  };
  preferredBrands: string[];
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  storage: string;
  color: string;
  colorHex: string;
  priceUgx: number;
  stockQty: number;
  reservedQty: number;
  availableQty: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  model: string;
  condition: "new" | "refurbished" | "used";
  conditionGrade: string;
  batteryHealth: number | null;
  networkCompatibility: string;
  warrantyMonths: number;
  warrantyTerms: string;
  description: string;
  specs: {
    display: string;
    processor: string;
    ram: string;
    camera: string;
    battery: string;
    sim: string;
    os: string;
  };
  basePriceUgx: number;
  compareAtPriceUgx: number | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isSwapEligible: boolean;
  isActive: boolean;
  isSampleData: boolean;
  brand: { id: number; name: string; slug: string } | null;
  category: { id: number; name: string; slug: string } | null;
  variants: ProductVariant[];
  images: Array<{ id: number; url: string; altText: string; isPrimary: boolean }>;
  primaryImageUrl: string;
  totalAvailableStock: number;
  reviewCount: number;
  averageRating: number | null;
}

export interface DeliveryZone {
  id: number;
  name: string;
  feeUgx: number;
  estimatedTime: string;
  instructions: string;
  isStoreCollection: boolean;
}

export interface CartItemView {
  cartItemId: number;
  quantity: number;
  variantId: number;
  sku: string;
  storage: string;
  color: string;
  colorHex: string;
  priceUgx: number;
  availableQty: number;
  productId: number;
  productName: string;
  productSlug: string;
  condition: string;
  imageUrl: string;
  lineTotalUgx: number;
}

export interface CartState {
  id: number;
  items: CartItemView[];
  itemCount: number;
  subtotalUgx: number;
  discountUgx: number;
  deliveryFeeUgx: number;
  totalUgx: number;
  appliedDiscountCode: string | null;
}

export interface OrderRecord {
  id: number;
  orderRef: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotalUgx: number;
  discountUgx: number;
  deliveryFeeUgx: number;
  totalUgx: number;
  collectionOption: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  deliveryNotes: string;
  createdAt: string;
  items: Array<{
    id: number;
    productNameSnapshot: string;
    variantSnapshot: string;
    unitPriceUgx: number;
    quantity: number;
    lineTotalUgx: number;
  }>;
  payments: Array<{
    id: number;
    provider: string;
    providerRef: string;
    amountUgx: number;
    status: string;
    isSimulated: boolean;
  }>;
}

export interface SwapRequestRecord {
  id: number;
  swapRef: string;
  currentBrand: string;
  currentModel: string;
  currentStorage: string;
  currentColor: string;
  physicalCondition: string;
  batteryCondition: string;
  screenCondition: string;
  cameraCondition: string;
  powersOn: boolean;
  hasBeenRepaired: boolean;
  includesBoxOrAccessories: string;
  status: string;
  provisionalEstimateUgx: number;
  offeredValuationUgx: number | null;
  finalConfirmedValuationUgx: number | null;
  targetPriceUgx: number;
  payableDifferenceUgx: number;
  staffNotes: string;
  createdAt: string;
  targetProduct: { id: number; name: string; primaryImageUrl: string } | null;
  targetVariant: { id: number; storage: string; color: string; priceUgx: number } | null;
  photos: Array<{ id: number; angleLabel: string; url: string }>;
  valuations: Array<{
    id: number;
    stage: string;
    amountUgx: number;
    payableDifferenceUgx: number;
    notes: string;
    customerDecision: string | null;
    createdAt: string;
  }>;
  statusHistory: Array<{
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string;
    createdAt: string;
  }>;
  appointments: Array<{
    id: number;
    scheduledDate: string;
    timeSlot: string;
    locationType: string;
    locationDetails: string;
    status: string;
    inspectionNotes: string;
  }>;
  messages: Array<{
    id: number;
    senderRole: string;
    message: string;
    createdAt: string;
  }>;
}

export interface ArticleRecord {
  id: number;
  title: string;
  slug: string;
  category: string;
  summary: string;
  contentMarkdown: string;
  coverImageUrl: string;
  authorName: string;
  readingTimeMin: number;
  tags: string[];
  relatedProductIds: number[];
  quizQuestions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  isSampleData: boolean;
  publishedAt: string;
}

export interface TikTokVideoRecord {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string;
  category: string;
  linkedProductIds: number[];
  linkedArticleIds: number[];
  displayOrder: number;
  isSampleData: boolean;
}

export interface StoreInfo {
  brandName: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  hours: string;
  tiktokUrl: string;
  paymentProviderMode: string;
}
