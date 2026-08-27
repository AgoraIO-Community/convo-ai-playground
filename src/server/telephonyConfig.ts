export interface TelephonyServerConfig {
  baseUrl: string;
  phoneNumberId: number;
  appId: string;
  customerId: string;
  customerSecret: string;
}

function requireValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function readTelephonyConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelephonyServerConfig {
  const baseUrl = requireValue(env, "AGENT_STUDIO_V2_BASE_URL").replace(
    /\/$/,
    "",
  );
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("AGENT_STUDIO_V2_BASE_URL must use HTTPS");
  }

  const phoneNumberId = Number(
    requireValue(env, "AGORA_TELEPHONY_PHONE_NUMBER_ID"),
  );
  if (!Number.isInteger(phoneNumberId) || phoneNumberId <= 0) {
    throw new Error(
      "AGORA_TELEPHONY_PHONE_NUMBER_ID must be a positive integer",
    );
  }

  return {
    baseUrl,
    phoneNumberId,
    appId: requireValue(env, "NEXT_PUBLIC_AGORA_APP_ID"),
    customerId: requireValue(env, "AGORA_CUSTOMER_ID"),
    customerSecret: requireValue(env, "AGORA_CUSTOMER_SECRET"),
  };
}

export function buildTelephonyAuthorization(
  config: TelephonyServerConfig,
): string {
  return `Basic ${Buffer.from(
    `${config.customerId}:${config.customerSecret}`,
  ).toString("base64")}`;
}
