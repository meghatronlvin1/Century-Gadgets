export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Century Gadgets API",
    version: "1.0.0",
    description:
      "Production-oriented REST API for Century Gadgets (Uganda) — Smartphone E-Commerce, Phone Swap & Trade-In, Educational Learn Hub, TikTok Curation, and Staff Operations.",
  },
  servers: [{ url: "/api/v1", description: "Version 1 API" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT / Firebase ID Token",
      },
    },
  },
  paths: {
    "/health": {
      get: { summary: "API health check", responses: { "200": { description: "Healthy" } } },
    },
    "/auth/register": {
      post: { summary: "Register customer account with email/phone", responses: { "201": { description: "Created" } } },
    },
    "/auth/login": {
      post: { summary: "Sign in with email/phone and password", responses: { "200": { description: "Authenticated" } } },
    },
    "/auth/sync": {
      post: {
        summary: "Sync Firebase authenticated user profile to PostgreSQL",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "User profile synced" } },
      },
    },
    "/catalog/bootstrap": {
      get: { summary: "Fetch storefront bootstrap collections, categories, brands, and delivery zones", responses: { "200": { description: "OK" } } },
    },
    "/catalog/products": {
      get: { summary: "Search, filter, sort, and paginate smartphone catalogue", responses: { "200": { description: "OK" } } },
    },
    "/catalog/products/{idOrSlug}": {
      get: { summary: "Get detailed product specifications, variants, and reviews", responses: { "200": { description: "OK" } } },
    },
    "/cart": {
      get: { summary: "Get current cart with server-verified UGX totals", responses: { "200": { description: "OK" } } },
    },
    "/cart/items": {
      post: { summary: "Add product variant to cart with stock check", responses: { "200": { description: "Updated cart" } } },
    },
    "/checkout": {
      post: {
        summary: "Create order transactionally with idempotency protection and payment initiation",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Order created" } },
      },
    },
    "/payments/webhook": {
      post: { summary: "Server-side payment provider webhook verified via HMAC-SHA256 signature", responses: { "200": { description: "Webhook processed" } } },
    },
    "/swaps": {
      get: { summary: "List customer phone swap requests", security: [{ bearerAuth: [] }], responses: { "200": { description: "OK" } } },
      post: { summary: "Submit new phone swap request with provisional estimate", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } },
    },
    "/swaps/{id}/respond": {
      post: { summary: "Accept or decline a staff-issued swap valuation", security: [{ bearerAuth: [] }], responses: { "200": { description: "Decision recorded" } } },
    },
    "/swaps/{id}/appointment": {
      post: { summary: "Book inspection appointment or store drop-off", security: [{ bearerAuth: [] }], responses: { "201": { description: "Appointment scheduled" } } },
    },
    "/learn/articles": {
      get: { summary: "List Century Gadgets educational articles", responses: { "200": { description: "OK" } } },
    },
    "/learn/recommend": {
      post: { summary: "Guided 'Which Phone Should I Buy?' live catalogue matcher", responses: { "200": { description: "Recommendations returned" } } },
    },
    "/tiktok/videos": {
      get: { summary: "List curated Century Gadgets TikTok educational videos", responses: { "200": { description: "OK" } } },
    },
    "/admin/overview": {
      get: { summary: "Staff RBAC dashboard KPIs", security: [{ bearerAuth: [] }], responses: { "200": { description: "OK" } } },
    },
  },
};
