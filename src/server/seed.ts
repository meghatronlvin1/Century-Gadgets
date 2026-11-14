import { count, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  articles,
  brands,
  categories,
  deliveryZones,
  discountCodes,
  inventoryMovements,
  productImages,
  productVariants,
  products,
  storeSettings,
  tiktokVideos,
  users,
} from "../db/schema.ts";
import { hashPassword } from "./auth.ts";

let seededPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seededPromise) {
    seededPromise = runSeed().catch((err) => {
      seededPromise = null;
      throw err;
    });
  }
  return seededPromise;
}

async function runSeed(): Promise<void> {
  const existingBrands = await db.select({ total: count() }).from(brands);
  if (Number(existingBrands[0]?.total ?? 0) > 0) {
    return;
  }

  // 1. Store settings from environment variables
  await db
    .insert(storeSettings)
    .values({
      key: "store_info",
      value: {
        brandName: "Century Gadgets",
        phone: process.env.CENTURY_STORE_PHONE || "+256 700 000 000 (Configure CENTURY_STORE_PHONE)",
        whatsappNumber: process.env.CENTURY_WHATSAPP_NUMBER || "+256700000000",
        address:
          process.env.CENTURY_STORE_ADDRESS ||
          "Kampala Road, Mabirizi Complex Level 2, Shop L2-14, Kampala, Uganda",
        hours: process.env.CENTURY_STORE_HOURS || "Mon–Sat: 9:00 AM – 7:30 PM | Sun: 11:00 AM – 5:00 PM",
        tiktokUrl: process.env.CENTURY_TIKTOK_URL || "https://www.tiktok.com/@centurygadgets",
        paymentProviderMode: process.env.PAYMENT_PROVIDER_MODE || "sandbox",
      },
    })
    .onConflictDoNothing();

  // 2. Seed Brands
  const brandRows = await db
    .insert(brands)
    .values([
      { name: "Apple", slug: "apple", sortOrder: 1 },
      { name: "Samsung", slug: "samsung", sortOrder: 2 },
      { name: "Google Pixel", slug: "google-pixel", sortOrder: 3 },
      { name: "Tecno", slug: "tecno", sortOrder: 4 },
      { name: "Infinix", slug: "infinix", sortOrder: 5 },
      { name: "Redmi / Xiaomi", slug: "redmi-xiaomi", sortOrder: 6 },
      { name: "Accessories", slug: "accessories", sortOrder: 7 },
    ])
    .returning();

  const brandBySlug = Object.fromEntries(brandRows.map((b) => [b.slug, b.id]));

  // 3. Seed Categories
  const categoryRows = await db
    .insert(categories)
    .values([
      { name: "iPhones", slug: "iphones", description: "Brand new and verified pre-owned iPhones", sortOrder: 1 },
      { name: "Samsung", slug: "samsung", description: "Galaxy S, Z, and A-series smartphones", sortOrder: 2 },
      { name: "Google Pixel", slug: "google-pixel", description: "Clean Android cameras & AI phones", sortOrder: 3 },
      { name: "Tecno & Infinix", slug: "tecno-infinix", description: "Everyday high-value devices", sortOrder: 4 },
      { name: "Redmi / Xiaomi", slug: "redmi-xiaomi", description: "Performance & fast-charging phones", sortOrder: 5 },
      { name: "Accessories", slug: "accessories", description: "Chargers, earbuds, cases & protection", sortOrder: 6 },
    ])
    .returning();

  const catBySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

  // 4. Seed clearly labelled sample Products + Variants + Images
  const sampleCatalog = [
    {
      name: "iPhone 15 Pro",
      slug: "iphone-15-pro",
      brandId: brandBySlug["apple"],
      categoryId: catBySlug["iphones"],
      model: "A3102 (Global eSIM + Physical SIM)",
      condition: "new",
      conditionGrade: "Brand New Factory Sealed",
      batteryHealth: 100,
      networkCompatibility: "5G / 4G LTE · MTN & Airtel Uganda Verified",
      warrantyMonths: 12,
      warrantyTerms: "12-month Apple & Century Gadgets hardware warranty",
      description:
        "Aerospace-grade titanium design powered by the A17 Pro chip, 48MP Pro camera system with 3x telephoto, and USB-C fast transfer. Sample catalogue entry for verification.",
      specs: {
        display: '6.1" Super Retina XDR OLED 120Hz',
        processor: "Apple A17 Pro (3nm)",
        ram: "8GB",
        camera: "48MP Main + 12MP Ultra Wide + 12MP 3x Telephoto",
        battery: "3274 mAh · USB-C Fast Charge",
        sim: "Nano-SIM + eSIM",
        os: "iOS 18 Ready",
      },
      basePriceUgx: 4250000,
      compareAtPriceUgx: 4550000,
      isFeatured: true,
      isBestSeller: true,
      popularityScore: 98,
      imageKey: "media:iphone",
      variants: [
        { sku: "CG-IP15P-256-NAT", storage: "256GB", color: "Natural Titanium", colorHex: "#9A978E", priceUgx: 4250000, stockQty: 6 },
        { sku: "CG-IP15P-512-NVY", storage: "512GB", color: "Blue Titanium", colorHex: "#1E3046", priceUgx: 4750000, stockQty: 3 },
      ],
    },
    {
      name: "iPhone 14 Pro (Verified Pre-Owned)",
      slug: "iphone-14-pro-refurbished",
      brandId: brandBySlug["apple"],
      categoryId: catBySlug["iphones"],
      model: "A2890 (Unlocked)",
      condition: "refurbished",
      conditionGrade: "Grade A+ Certified · Zero Repairs",
      batteryHealth: 94,
      networkCompatibility: "5G / 4G LTE · MTN & Airtel Uganda Verified",
      warrantyMonths: 6,
      warrantyTerms: "6-month Century Gadgets hardware & battery guarantee",
      description:
        "32-point inspected iPhone 14 Pro with Dynamic Island, 120Hz ProMotion display, and verified original battery health above 92%. Sample catalogue entry.",
      specs: {
        display: '6.1" Super Retina XDR 120Hz',
        processor: "Apple A16 Bionic",
        ram: "6GB",
        camera: "48MP Main + 12MP Ultra Wide + 12MP Telephoto",
        battery: "3200 mAh · 94% Verified Health",
        sim: "Nano-SIM + eSIM",
        os: "iOS 18 Ready",
      },
      basePriceUgx: 2950000,
      compareAtPriceUgx: 3250000,
      isFeatured: false,
      isBestSeller: true,
      popularityScore: 94,
      imageKey: "media:iphone",
      variants: [
        { sku: "CG-IP14P-128-BLK", storage: "128GB", color: "Space Black", colorHex: "#202226", priceUgx: 2950000, stockQty: 5 },
        { sku: "CG-IP14P-256-SLV", storage: "256GB", color: "Silver", colorHex: "#E2E4E8", priceUgx: 3250000, stockQty: 4 },
      ],
    },
    {
      name: "Samsung Galaxy S24 Ultra",
      slug: "samsung-galaxy-s24-ultra",
      brandId: brandBySlug["samsung"],
      categoryId: catBySlug["samsung"],
      model: "SM-S928B/DS (Dual SIM)",
      condition: "new",
      conditionGrade: "Brand New Factory Sealed",
      batteryHealth: 100,
      networkCompatibility: "5G / 4G LTE · Dual Physical SIM + eSIM",
      warrantyMonths: 12,
      warrantyTerms: "12-month Samsung East Africa & Century Gadgets warranty",
      description:
        "Titanium frame flagship with integrated S Pen, 200MP quad camera with 5x optical zoom, and anti-reflective Gorilla Armor display. Sample catalogue entry.",
      specs: {
        display: '6.8" Dynamic AMOLED 2X 120Hz QHD+',
        processor: "Snapdragon 8 Gen 3 for Galaxy",
        ram: "12GB",
        camera: "200MP Main + 50MP 5x Periscope + 12MP UW",
        battery: "5000 mAh · 45W Super Fast Charge",
        sim: "Dual Nano-SIM + eSIM",
        os: "Android 14 / One UI 6.1",
      },
      basePriceUgx: 4400000,
      compareAtPriceUgx: 4700000,
      isFeatured: true,
      isBestSeller: true,
      popularityScore: 96,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-S24U-256-GRY", storage: "256GB", color: "Titanium Gray", colorHex: "#7A7B77", priceUgx: 4400000, stockQty: 7 },
        { sku: "CG-S24U-512-BLK", storage: "512GB", color: "Titanium Black", colorHex: "#1D1F22", priceUgx: 4900000, stockQty: 3 },
      ],
    },
    {
      name: "Samsung Galaxy A55 5G",
      slug: "samsung-galaxy-a55-5g",
      brandId: brandBySlug["samsung"],
      categoryId: catBySlug["samsung"],
      model: "SM-A556E/DS",
      condition: "new",
      conditionGrade: "Brand New Factory Sealed",
      batteryHealth: 100,
      networkCompatibility: "5G / 4G LTE · Dual SIM",
      warrantyMonths: 12,
      warrantyTerms: "12-month official warranty",
      description:
        "Brushed aluminum frame, IP67 water resistance, 50MP OIS camera, and 4 years of OS upgrades. Ideal mid-range daily driver in Uganda. Sample catalogue entry.",
      specs: {
        display: '6.6" Super AMOLED 120Hz',
        processor: "Exynos 1480",
        ram: "8GB",
        camera: "50MP OIS Main + 12MP UW + 5MP Macro",
        battery: "5000 mAh · 25W Fast Charge",
        sim: "Dual Nano-SIM",
        os: "Android 14 / One UI 6.1",
      },
      basePriceUgx: 1420000,
      compareAtPriceUgx: 1550000,
      isFeatured: false,
      isBestSeller: true,
      popularityScore: 89,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-A55-128-NVY", storage: "128GB", color: "Awesome Navy", colorHex: "#102747", priceUgx: 1420000, stockQty: 11 },
        { sku: "CG-A55-256-ICE", storage: "256GB", color: "Awesome Iceblue", colorHex: "#CFE0EE", priceUgx: 1620000, stockQty: 6 },
      ],
    },
    {
      name: "Google Pixel 8 Pro (Verified)",
      slug: "google-pixel-8-pro",
      brandId: brandBySlug["google-pixel"],
      categoryId: catBySlug["google-pixel"],
      model: "GC3VE (Factory Unlocked)",
      condition: "used",
      conditionGrade: "Grade A Clean · Tested in Kampala",
      batteryHealth: 96,
      networkCompatibility: "5G / 4G LTE · Nano-SIM + eSIM",
      warrantyMonths: 6,
      warrantyTerms: "6-month Century Gadgets verified warranty",
      description:
        "Pure Google Android experience with computational photography, 5x optical telephoto lens, and 7 years of security updates. Sample catalogue entry.",
      specs: {
        display: '6.7" Super Actua LTPO OLED 120Hz',
        processor: "Google Tensor G3",
        ram: "12GB",
        camera: "50MP Main + 48MP UW + 48MP 5x Telephoto",
        battery: "5050 mAh · 96% Verified Health",
        sim: "Nano-SIM + eSIM",
        os: "Android 15 Ready",
      },
      basePriceUgx: 2650000,
      compareAtPriceUgx: null,
      isFeatured: true,
      isBestSeller: false,
      popularityScore: 85,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-PX8P-128-OBS", storage: "128GB", color: "Obsidian", colorHex: "#1E1F21", priceUgx: 2650000, stockQty: 4 },
        { sku: "CG-PX8P-256-BAY", storage: "256GB", color: "Bay Blue", colorHex: "#699AC6", priceUgx: 2950000, stockQty: 2 },
      ],
    },
    {
      name: "Tecno Camon 30 Pro 5G",
      slug: "tecno-camon-30-pro-5g",
      brandId: brandBySlug["tecno"],
      categoryId: catBySlug["tecno-infinix"],
      model: "CL8 (12GB/512GB)",
      condition: "new",
      conditionGrade: "Brand New Sealed",
      batteryHealth: 100,
      networkCompatibility: "5G / 4G LTE · Dual SIM",
      warrantyMonths: 12,
      warrantyTerms: "12-month Carlcare & Century Gadgets warranty",
      description:
        "Creator-focused 50MP Sony IMX890 OIS camera, 144Hz AMOLED screen, 70W Ultra Charge in the box, and 512GB massive storage. Sample catalogue entry.",
      specs: {
        display: '6.78" AMOLED 144Hz',
        processor: "MediaTek Dimensity 8200 Ultimate",
        ram: "12GB",
        camera: "50MP Sony IMX890 OIS + 50MP UW",
        battery: "5000 mAh · 70W Ultra Charge",
        sim: "Dual Nano-SIM",
        os: "Android 14 / HiOS 14",
      },
      basePriceUgx: 1350000,
      compareAtPriceUgx: null,
      isFeatured: false,
      isBestSeller: true,
      popularityScore: 87,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-CAM30P-512-BLK", storage: "512GB", color: "Iceland Basaltic Dark", colorHex: "#242830", priceUgx: 1350000, stockQty: 9 },
      ],
    },
    {
      name: "Infinix Note 40 Pro",
      slug: "infinix-note-40-pro",
      brandId: brandBySlug["infinix"],
      categoryId: catBySlug["tecno-infinix"],
      model: "X6850",
      condition: "new",
      conditionGrade: "Brand New Sealed",
      batteryHealth: 100,
      networkCompatibility: "4G LTE · Dual SIM",
      warrantyMonths: 12,
      warrantyTerms: "12-month Carlcare warranty",
      description:
        "Curved 120Hz AMOLED display with 70W All-Round FastCharge 2.0 and magnetic wireless MagCharge pad included. Sample catalogue entry.",
      specs: {
        display: '6.78" Curved AMOLED 120Hz',
        processor: "MediaTek Helio G99 Ultimate",
        ram: "8GB",
        camera: "108MP OIS Super-Zoom",
        battery: "5000 mAh · 70W + 20W MagCharge",
        sim: "Dual Nano-SIM",
        os: "Android 14 / XOS 14",
      },
      basePriceUgx: 980000,
      compareAtPriceUgx: null,
      isFeatured: false,
      isBestSeller: false,
      popularityScore: 80,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-INFN40P-256-GLD", storage: "256GB", color: "Titan Gold", colorHex: "#C5B084", priceUgx: 980000, stockQty: 12 },
      ],
    },
    {
      name: "Redmi Note 13 Pro+ 5G",
      slug: "redmi-note-13-pro-plus-5g",
      brandId: brandBySlug["redmi-xiaomi"],
      categoryId: catBySlug["redmi-xiaomi"],
      model: "23090RA98G",
      condition: "new",
      conditionGrade: "Brand New Sealed",
      batteryHealth: 100,
      networkCompatibility: "5G / 4G LTE · Dual SIM",
      warrantyMonths: 12,
      warrantyTerms: "12-month Century Gadgets warranty",
      description:
        "200MP OIS camera, IP68 dust and water resistance, curved 1.5K AMOLED display, and 120W HyperCharge (0-100% in ~19 minutes). Sample catalogue entry.",
      specs: {
        display: '6.67" 1.5K CrystalRes AMOLED 120Hz',
        processor: "MediaTek Dimensity 7200-Ultra",
        ram: "8GB",
        camera: "200MP OIS + 8MP UW + 2MP Macro",
        battery: "5000 mAh · 120W HyperCharge",
        sim: "Dual Nano-SIM + eSIM",
        os: "Android 14 / HyperOS",
      },
      basePriceUgx: 1280000,
      compareAtPriceUgx: null,
      isFeatured: false,
      isBestSeller: false,
      popularityScore: 82,
      imageKey: "media:samsung",
      variants: [
        { sku: "CG-RN13PP-256-BLK", storage: "256GB", color: "Midnight Black", colorHex: "#181A1E", priceUgx: 1280000, stockQty: 8 },
      ],
    },
    {
      name: "65W GaN Fast Charger + Braided USB-C Kit",
      slug: "65w-gan-charger-usbc-kit",
      brandId: brandBySlug["accessories"],
      categoryId: catBySlug["accessories"],
      model: "CG-GAN65-UK",
      condition: "new",
      conditionGrade: "Original Retail Box",
      batteryHealth: null,
      networkCompatibility: "Universal USB-C PD 3.0 / PPS (iPhone 15, Samsung, Pixel, MacBook)",
      warrantyMonths: 6,
      warrantyTerms: "6-month instant replacement warranty",
      description:
        "Authentic surge-protected UK 3-pin 65W Gallium Nitride dual-port fast adapter engineered for Ugandan power grids, paired with a 100W braided USB-C cable. Sample catalogue entry.",
      specs: {
        display: "N/A",
        processor: "GaN Power Delivery 3.0 + PPS",
        ram: "N/A",
        camera: "N/A",
        battery: "65W Dual USB-C + USB-A Output",
        sim: "UK 3-Pin Plug",
        os: "iOS & Android Compatible",
      },
      basePriceUgx: 125000,
      compareAtPriceUgx: null,
      isFeatured: false,
      isBestSeller: true,
      popularityScore: 91,
      imageKey: "media:accessories",
      variants: [
        { sku: "CG-GAN65-BLK", storage: "Standard", color: "Obsidian Black", colorHex: "#1F242D", priceUgx: 125000, stockQty: 25 },
      ],
    },
    {
      name: "Studio ANC Wireless Earbuds + MagSafe Power Bank",
      slug: "studio-anc-earbuds-power-pack",
      brandId: brandBySlug["accessories"],
      categoryId: catBySlug["accessories"],
      model: "CG-AUDIO-PRO",
      condition: "new",
      conditionGrade: "Brand New Sealed",
      batteryHealth: null,
      networkCompatibility: "Bluetooth 5.3 · iPhone & Android Compatible",
      warrantyMonths: 6,
      warrantyTerms: "6-month Century Gadgets accessory warranty",
      description:
        "Active noise cancelling wireless earbuds with transparency mode paired with a slim 5000mAh magnetic wireless battery pack. Sample catalogue entry.",
      specs: {
        display: "LED Charge Indicator",
        processor: "Bluetooth 5.3 Low-Latency",
        ram: "N/A",
        camera: "Dual Beamforming Mics",
        battery: "30h Earbuds + 5000mAh MagPack",
        sim: "USB-C + Qi Wireless",
        os: "Universal iOS & Android",
      },
      basePriceUgx: 285000,
      compareAtPriceUgx: 320000,
      isFeatured: true,
      isBestSeller: false,
      popularityScore: 84,
      imageKey: "media:accessories",
      variants: [
        { sku: "CG-ANC-WHT", storage: "5000mAh Kit", color: "Matte White & Slate", colorHex: "#E5E7EB", priceUgx: 285000, stockQty: 14 },
      ],
    },
  ];

  const insertedProductIds: number[] = [];

  for (const p of sampleCatalog) {
    const [prod] = await db
      .insert(products)
      .values({
        name: p.name,
        slug: p.slug,
        brandId: p.brandId,
        categoryId: p.categoryId,
        model: p.model,
        condition: p.condition,
        conditionGrade: p.conditionGrade,
        batteryHealth: p.batteryHealth,
        networkCompatibility: p.networkCompatibility,
        warrantyMonths: p.warrantyMonths,
        warrantyTerms: p.warrantyTerms,
        description: p.description,
        specs: p.specs,
        basePriceUgx: p.basePriceUgx,
        compareAtPriceUgx: p.compareAtPriceUgx,
        isFeatured: p.isFeatured,
        isBestSeller: p.isBestSeller,
        isSwapEligible: p.categoryId !== catBySlug["accessories"],
        isSampleData: true,
        popularityScore: p.popularityScore,
      })
      .returning();

    insertedProductIds.push(prod.id);

    await db.insert(productImages).values({
      productId: prod.id,
      url: p.imageKey,
      altText: `${p.name} studio photo`,
      sortOrder: 0,
      isPrimary: true,
    });

    for (const v of p.variants) {
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: prod.id,
          sku: v.sku,
          storage: v.storage,
          color: v.color,
          colorHex: v.colorHex,
          priceUgx: v.priceUgx,
          stockQty: v.stockQty,
          reservedQty: 0,
        })
        .returning();

      await db.insert(inventoryMovements).values({
        variantId: variant.id,
        deltaQty: v.stockQty,
        previousQty: 0,
        newQty: v.stockQty,
        reason: "Initial sample catalogue stock seed",
        referenceType: "seed",
        referenceId: prod.slug,
      });
    }
  }

  // 5. Delivery Zones (Uganda)
  await db.insert(deliveryZones).values([
    {
      name: "Store Collection — Mabirizi Complex, Kampala Rd",
      feeUgx: 0,
      estimatedTime: "Ready in 1–2 hours",
      instructions: "Bring valid National ID or Passport and your order reference number.",
      isStoreCollection: true,
    },
    {
      name: "Kampala Central, Kololo, Nakasero & Bugolobi",
      feeUgx: 10000,
      estimatedTime: "Same-day courier (2–4 hours)",
      instructions: "Courier calls 15 minutes before arrival.",
      isStoreCollection: false,
    },
    {
      name: "Ntinda, Kira, Naalya, Entebbe Rd & Wakiso",
      feeUgx: 20000,
      estimatedTime: "Same-day or next morning",
      instructions: "Dispatched via Century Gadgets insured rider.",
      isStoreCollection: false,
    },
    {
      name: "Mukono, Entebbe Town & Jinja",
      feeUgx: 30000,
      estimatedTime: "Next business day",
      instructions: "Tracked parcel handover with signature confirmation.",
      isStoreCollection: false,
    },
    {
      name: "Upcountry Courier (Mbarara, Gulu, Mbale, Fort Portal)",
      feeUgx: 40000,
      estimatedTime: "1–2 business days",
      instructions: "Sealed security-taped parcel via trusted regional courier.",
      isStoreCollection: false,
    },
  ]);

  // 6. Discount Codes
  await db.insert(discountCodes).values([
    {
      code: "WELCOME50",
      description: "UGX 50,000 off orders of UGX 1,000,000 or more",
      discountType: "fixed_ugx",
      value: 50000,
      minOrderUgx: 1000000,
    },
    {
      code: "LEARNER5",
      description: "5% off phones & accessories above UGX 200,000",
      discountType: "percentage",
      value: 5,
      minOrderUgx: 200000,
    },
  ]);

  // 7. Educational Articles
  const articleRows = await db
    .insert(articles)
    .values([
      {
        title: "How to Verify an iPhone or Samsung Before Buying in Kampala",
        slug: "how-to-verify-phone-before-buying",
        category: "How to verify a phone before buying it",
        summary:
          "A practical 6-step physical and software inspection checklist to spot replaced screens, tampered batteries, or carrier-locked devices before you pay.",
        contentMarkdown: `Buying a flagship smartphone is a significant investment. Whether you are shopping brand new or certified pre-owned, verify these essentials before completing payment:\n\n1. Match the IMEI in Settings (dial *#06#) against the SIM tray and original box.\n2. On iPhone, open Settings > General > About and check the Parts & Service History section for any "Unknown Part" warnings.\n3. Check Battery Health under Settings > Battery. For a pre-owned iPhone, look for 88% or higher unless priced accordingly.\n4. Test True Tone, Face ID / Ultrasonic Fingerprint, all camera lenses (0.5x, 1x, 3x/5x), and microphone recordings.\n5. Confirm network unlock status by inserting an active MTN or Airtel SIM and verifying 4G/5G data connectivity.\n\nFact vs. Opinion: Verified IMEI and Parts History are objective hardware facts; colour preference and camera warmth are subjective preferences.`,
        coverImageUrl: "media:learn",
        authorName: "Century Gadgets Technical Team",
        readingTimeMin: 5,
        tags: ["Verification", "iPhone", "Samsung", "Buying Guide"],
        relatedProductIds: insertedProductIds.slice(0, 3),
        quizQuestions: [
          {
            question: "Which dial code displays a phone's IMEI number on both iOS and Android?",
            options: ["*#06#", "*100#", "*#9900#"],
            correctIndex: 0,
            explanation: "*#06# is the universal GSM standard code to display the device IMEI.",
          },
          {
            question: "Where on an iPhone can you check if the screen or battery was replaced with a non-genuine part?",
            options: ["Settings > Wallpaper", "Settings > General > About (Parts & Service History)", "Safari History"],
            correctIndex: 1,
            explanation: "iOS logs component replacements in Settings > General > About under Parts & Service History.",
          },
        ],
        isSampleData: true,
      },
      {
        title: "Refurbished vs Brand New Phones: What Actually Changes",
        slug: "refurbished-vs-brand-new-phones",
        category: "Refurbished versus new phones",
        summary:
          "Understand the real differences in warranty, battery cycles, water resistance seals, and long-term resale value in Uganda.",
        contentMarkdown: `Choosing between a factory-sealed device and a verified pre-owned/refurbished phone comes down to budget efficiency versus maximum battery lifespan.\n\nVerified Pre-Owned Advantages:\n- Typically 25%–35% lower cost than factory-sealed models.\n- Flagship chips (like Apple A16 or Tensor G3) remain faster than most brand-new budget phones.\n\nBrand New Sealed Advantages:\n- 100% factory battery health (0 charge cycles) and intact IP68 water-resistance seals.\n- Full 12-month manufacturer warranty.\n\nAt Century Gadgets, every pre-owned phone undergoes a 32-point bench inspection and displays its verified battery health openly.`,
        coverImageUrl: "media:iphone",
        authorName: "Century Gadgets Editorial",
        readingTimeMin: 4,
        tags: ["Refurbished", "Buying Guide", "Warranty"],
        relatedProductIds: [insertedProductIds[1], insertedProductIds[4]].filter(Boolean),
        quizQuestions: [
          {
            question: "Why can a 1-year-old refurbished flagship outperform a brand-new entry-level phone?",
            options: [
              "Because it has a heavier chassis",
              "Flagship processors, OIS cameras, and LTPO OLED displays remain superior",
              "Refurbished phones have unlimited storage",
            ],
            correctIndex: 1,
            explanation: "Flagship SoCs and stabilized optics typically stay ahead of entry-level hardware for 3–4 years.",
          },
        ],
        isSampleData: true,
      },
      {
        title: "Battery Health & Fast Charging: Protecting Your Phone",
        slug: "battery-health-and-fast-charging",
        category: "Battery health and charging",
        summary:
          "How wattage, USB-C Power Delivery, heat during charging, and voltage-safe GaN adapters preserve your battery beyond 800 cycles.",
        contentMarkdown: `Heat—not fast charging itself—is the primary cause of lithium-ion battery degradation.\n\nPractical rules for longer battery life:\n1. Use certified USB-C PD / PPS chargers that regulate voltage cleanly rather than unbranded adapters.\n2. Avoid gaming or heavy video calls while fast-charging.\n3. Enable Optimized Battery Charging (iPhone) or Adaptive Charging / 80% Protect Battery (Samsung & Pixel).\n4. Avoid letting your battery sit at 0% for days.\n\nFact: Lithium-ion cells experience the highest chemical stress when held at 100% voltage in high ambient temperatures.`,
        coverImageUrl: "media:accessories",
        authorName: "Century Gadgets Lab",
        readingTimeMin: 4,
        tags: ["Battery", "Charging", "Maintenance"],
        relatedProductIds: [insertedProductIds[8], insertedProductIds[9]].filter(Boolean),
        quizQuestions: [
          {
            question: "What is the biggest everyday contributor to premature smartphone battery wear?",
            options: ["Using Wi-Fi instead of Bluetooth", "Excessive heat during charging and heavy load", "Turning on Dark Mode"],
            correctIndex: 1,
            explanation: "High temperatures accelerate chemical aging inside lithium-ion cells.",
          },
        ],
        isSampleData: true,
      },
      {
        title: "Understanding RAM, Storage Speeds & 120Hz Displays",
        slug: "understanding-ram-storage-refresh-rates",
        category: "Understanding RAM, storage, processors, and refresh rates",
        summary:
          "Decode spec sheets without marketing jargon: why 8GB RAM + UFS storage matters more than inflated virtual RAM numbers.",
        contentMarkdown: `Spec sheets often highlight huge "extended RAM" numbers. Here is what actually affects everyday speed:\n\n- Physical RAM (6GB–12GB LPDDR5): Keeps apps open in memory without reloading. Virtual RAM uses slower flash storage and cannot match real RAM.\n- Storage Speed (UFS 3.1 / UFS 4.0 / NVMe): Determines how quickly photos save, apps install, and 4K video records.\n- 120Hz Refresh Rate: Refreshes the screen 120 times per second for smoother scrolling. LTPO panels drop down to 1Hz–10Hz to save battery when reading.`,
        coverImageUrl: "media:samsung",
        authorName: "Century Gadgets Editorial",
        readingTimeMin: 5,
        tags: ["Specs", "RAM", "Display"],
        relatedProductIds: [insertedProductIds[2], insertedProductIds[5], insertedProductIds[7]].filter(Boolean),
        quizQuestions: [],
        isSampleData: true,
      },
      {
        title: "Original vs Counterfeit Devices & Safe Phone Swapping",
        slug: "original-vs-counterfeit-and-swap-guide",
        category: "Original versus counterfeit devices",
        summary:
          "How Century Gadgets screens trade-in devices and how you can prepare your phone for a transparent, same-day swap in Kampala.",
        contentMarkdown: `A safe phone swap protects both the buyer and the seller.\n\nBefore bringing your device for a Century Gadgets trade-in inspection:\n1. Back up your WhatsApp chats, photos, and contacts to iCloud or Google Drive.\n2. Keep your phone charged above 50% so technicians can run display, camera, and battery diagnostics.\n3. Never share your personal Apple ID password, Google password, or PIN online—only sign out of Find My / Activation Lock in person once you accept the final confirmed valuation.\n\nEvery trade-in receives a provisional online estimate followed by a transparent physical inspection before the final offer is issued.`,
        coverImageUrl: "media:learn",
        authorName: "Century Gadgets Swap Desk",
        readingTimeMin: 4,
        tags: ["Swap", "Security", "Counterfeit Check"],
        relatedProductIds: insertedProductIds.slice(0, 4),
        quizQuestions: [],
        isSampleData: true,
      },
    ])
    .returning();

  // 8. Curated TikTok Videos (zero fabricated engagement numbers)
  await db.insert(tiktokVideos).values([
    {
      title: "3 Checks Before Buying Any Pre-Owned iPhone in Kampala",
      description: "See how our technicians inspect True Tone, Parts & Service History, and battery cycle health in under 60 seconds.",
      videoUrl: "https://www.tiktok.com/@centurygadgets",
      embedUrl: null,
      thumbnailUrl: "media:learn",
      category: "Verification",
      linkedProductIds: [insertedProductIds[0], insertedProductIds[1]].filter(Boolean),
      linkedArticleIds: [articleRows[0]?.id].filter(Boolean),
      displayOrder: 1,
      isFeatured: true,
      isAvailable: true,
      isSampleData: true,
    },
    {
      title: "How Our Phone Swap Process Works (Step by Step)",
      description: "Select your upgrade device, submit 4 clean photos for a provisional estimate, and book your in-store inspection.",
      videoUrl: "https://www.tiktok.com/@centurygadgets",
      embedUrl: null,
      thumbnailUrl: "media:hero",
      category: "Phone Swap",
      linkedProductIds: [insertedProductIds[2], insertedProductIds[3]].filter(Boolean),
      linkedArticleIds: [articleRows[4]?.id].filter(Boolean),
      displayOrder: 2,
      isFeatured: true,
      isAvailable: true,
      isSampleData: true,
    },
    {
      title: "Why Your Charger Matters: 65W GaN vs Cheap Adapters",
      description: "Protecting your battery health with surge-safe USB-C Power Delivery chargers.",
      videoUrl: "https://www.tiktok.com/@centurygadgets",
      embedUrl: null,
      thumbnailUrl: "media:accessories",
      category: "Accessories & Care",
      linkedProductIds: [insertedProductIds[8], insertedProductIds[9]].filter(Boolean),
      linkedArticleIds: [articleRows[2]?.id].filter(Boolean),
      displayOrder: 3,
      isFeatured: true,
      isAvailable: true,
      isSampleData: true,
    },
  ]);

  // 9. Seed Staff Demo Accounts (only if not yet created; owner email auto-promoted on Firebase sign-in too)
  const ownerEmail = process.env.CENTURY_OWNER_EMAIL || "kiwalabyemarkalvin@gmail.com";
  await db
    .insert(users)
    .values({
      uid: `seed-owner-${ownerEmail}`,
      email: ownerEmail,
      fullName: "Century Gadgets Owner",
      role: "administrator",
      emailVerified: true,
    })
    .onConflictDoNothing();

  // Seed a sample staff assessor for documentation/testing (random runtime password if not configured)
  const assessorEmail = "assessor@centurygadgets.ug";
  const existingAssessor = await db.select().from(users).where(eq(users.email, assessorEmail)).limit(1);
  if (existingAssessor.length === 0) {
    await db.insert(users).values({
      uid: "seed-assessor-01",
      email: assessorEmail,
      fullName: "Kampala Swap Desk Assessor",
      passwordHash: hashPassword("CenturyStaff!2026"),
      role: "swap_assessor",
      emailVerified: true,
    });
  }
}
