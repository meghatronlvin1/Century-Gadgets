# Required Third-Party Accounts, Credentials & Service Costs

To move **Century Gadgets** from development/sandbox mode to live commercial operation in Uganda, configure the following external accounts:

| Service | Purpose | Credentials Needed | Estimated Cost |
|---|---|---|---|
| **Google Cloud / Cloud SQL (PostgreSQL)** | Relational database for catalogue, orders, inventory, swaps | `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | Scale-to-zero free tier / ~$10–$30/mo production |
| **Firebase Authentication** | Customer & staff Google Sign-In + ID token verification | `firebase-applet-config.json` | Free up to 50,000 MAU (Spark/Blaze) |
| **MTN MoMo API / Flutterwave / Pesapal (Uganda)** | Live MTN Mobile Money, Airtel Money, and Visa/Mastercard collection + webhooks | Provider Merchant API Key, Public Key, `PAYMENT_WEBHOOK_SECRET` | ~2.5%–3.5% per transaction (Uganda Mobile Money & Cards) |
| **Cloud Storage (GCS / AWS S3 / Cloudflare R2)** | Persistent object storage for product photos and customer swap photos | Bucket name, Access Key / Service Account | ~$0.015–$0.023 per GB/month |
| **Expo Application Services (EAS)** | Android APK/AAB & iOS IPA cloud builds + Expo Push Notifications | Expo Account Token | Free tier (30 builds/mo) or $19–$99/mo |
| **Google Play Console** | Publishing Android app | Google Play Developer Account | $25 one-time registration fee |
| **Apple Developer Program** | Publishing iOS app | Apple Developer Account + Bundle ID (`ug.centurygadgets.app`) | $99/year |
| **TikTok Business / Content Curation** | Linking `@centurygadgets` tutorials | Official profile URL (`CENTURY_TIKTOK_URL`) + staff CMS entries | Free |
