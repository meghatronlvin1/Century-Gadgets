# Century Gadgets — Full-Stack Mobile, Web & Operations Platform

A full-stack smartphone e-commerce, phone swap/trade-in, technology education, TikTok curation, and staff operations platform built for **Century Gadgets** (Kampala, Uganda).

## Architecture Overview

1. **Backend API (`/server.ts`, `/src/server/`)**
   - Node.js + TypeScript + Express REST API versioned under `/api/v1/*`
   - PostgreSQL relational database managed via Drizzle ORM (`/src/db/schema.ts`)
   - Authentication via Firebase Authentication (Google Sign-In + Admin SDK verification) and signed short-lived access/refresh tokens for email/phone mobile clients
   - Role-Based Access Control (RBAC): `customer`, `administrator`, `inventory_manager`, `order_manager`, `swap_assessor`, `content_editor`
   - OpenAPI 3.0 spec exposed at `GET /api/v1/docs/openapi.json`
   - Transactional order creation, stock reservation, idempotency keys, and HMAC-SHA256 verified payment webhooks

2. **Web Storefront & Staff Administration Console (`/src/`)**
   - React 19 + TypeScript + Tailwind CSS v4 following the Century Gadgets visual identity (`#102747` Navy, `#FFFFFF`, `#F5F7FA`, `#667085`, `#E3E8EF`)
   - 5-tab customer experience (`Home`, `Shop`, `Swap`, `Learn`, `Account`) + persistent Cart & 8-step Checkout drawer
   - Dedicated Staff Admin Dashboard accessible to staff roles via Account -> Open Staff Admin Console

3. **React Native + Expo Mobile Application (`/mobile/`)**
   - Genuine Expo SDK 52 + Expo Router + TypeScript project
   - Zustand + `expo-secure-store` for sensitive tokens
   - TanStack Query, React Hook Form + Zod, `expo-image-picker`, and `expo-notifications`
   - Complete 5-tab mobile navigation (`Home`, `Shop`, `Swap`, `Learn`, `Account`) + Product Detail & Cart screens

---

## Setup & Launch Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your environment secrets (never commit `.env`):
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`
- `APP_TOKEN_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_MODE`
- `CENTURY_STORE_PHONE`, `CENTURY_WHATSAPP_NUMBER`, `CENTURY_STORE_ADDRESS`, `CENTURY_STORE_HOURS`, `CENTURY_TIKTOK_URL`

### 2. Database Schema & Seeding
Push the Drizzle schema to PostgreSQL:
```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```
Initial sample UGX products, Ugandan delivery zones, discount codes (`WELCOME50`, `LEARNER5`), educational articles, and TikTok entries are seeded automatically and idempotently via `ensureSeeded()` on the first API request (`isSampleData: true` is clearly marked on sample records).

### 3. Run the Full-Stack Server (Web + API on Port 3000)
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### 4. Run Automated Tests & Typecheck
```bash
npm run lint
npm test
```

---

## React Native Mobile App Launch (`/mobile`)

```bash
cd mobile
npm install
npx expo start
```
Set `EXPO_PUBLIC_API_URL=https://your-backend-host/api/v1` before launching on physical Android/iOS devices.

### Android Build Instructions (EAS)
```bash
cd mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview    # Generates installable APK
eas build -p android --profile production # Generates Google Play AAB
```

### iOS Build Instructions (EAS)
```bash
cd mobile
eas build -p ios --profile production     # Requires Apple Developer account
eas submit -p ios --profile production
```

---

## Production Deployment

1. Build frontend assets: `npm run build`
2. Provision PostgreSQL (Cloud SQL or managed Postgres) and configure environment variables.
3. Run `npx drizzle-kit push --config=src/db/drizzle.config.ts`.
4. Start production server: `NODE_ENV=production npm start` (listens on port `3000` or `PORT`).
5. Configure payment provider webhook URL to `https://your-domain/api/v1/payments/webhook` with `x-century-signature` HMAC-SHA256 verification.
