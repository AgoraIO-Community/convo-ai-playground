import type { AgentSettings } from "@/types/agora";
import { migrateAgentSettings } from "@/lib/agora/engineConfig";
import {
  buildJoinProperties,
  validateAgentSettings,
} from "@/lib/agora/joinPayload";
import { hydrateAgentProviderCredentials } from "./agentProviderCredentials";

const TELEPHONY_RUNTIME_FIELDS = [
  "channel",
  "token",
  "agent_rtc_uid",
  "remote_rtc_uids",
  "enable_string_uid",
] as const;

export function buildTelephonyAgentProperties(input: {
  settings: AgentSettings;
  username: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  const settings = migrateAgentSettings(input.settings);
  const validation = validateAgentSettings(settings);
  if (!validation.valid) {
    throw new Error(
      validation.errors.map((error) => error.message).join(" "),
    );
  }

  const properties = buildJoinProperties({
    settings,
    runtime: {
      channel: "__AGORA_TELEPHONY_RUNTIME__",
      token: "__AGORA_TELEPHONY_RUNTIME__",
      agentRtcUid: "0",
      remoteRtcUids: ["*"],
      username: input.username.trim() || "Guest",
    },
  });

  for (const field of TELEPHONY_RUNTIME_FIELDS) delete properties[field];
  delete properties.avatar;

  return hydrateAgentProviderCredentials(properties, input.env);
}
