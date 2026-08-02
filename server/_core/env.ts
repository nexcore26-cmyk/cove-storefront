export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Cove Interior <orders@coveinterior.com>",
  // Payment gateways
  paymentGateway: process.env.PAYMENT_GATEWAY ?? "myfatoorah", // "myfatoorah" | "tap" | "cod"
  myfatoorahApiKey: process.env.MYFATOORAH_API_KEY ?? "",
  myfatoorahWebhookSecret: process.env.MYFATOORAH_WEBHOOK_SECRET ?? "",
  myfatoorahCountryCode: process.env.MYFATOORAH_COUNTRY_CODE ?? "KWT",
  myfatoorahIsTest: process.env.MYFATOORAH_IS_TEST !== "false", // default true until live key provided
  tapSecretKey: process.env.TAP_SECRET_KEY ?? "",
};
