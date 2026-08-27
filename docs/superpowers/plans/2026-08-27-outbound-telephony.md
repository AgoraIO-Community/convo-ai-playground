# Outbound Telephony Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated Telephony Settings tab that starts one-off outbound Agora telephone calls with phone-number ID `851` and the Playground's current agent configuration, without a Studio pipeline ID.

**Architecture:** The browser posts a narrow, typed request to a protected Next.js route. The route validates configuration, builds the same normalized agent properties used by the existing invite route, injects server-only provider credentials, and calls the verified Agent Studio V2 outbound-dial gateway using server-generated Basic Auth. SIP and Agora credentials never enter the client bundle.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.8, Zustand 5, Auth.js, Vitest, Testing Library, Agora Conversational AI V2 gateway.

**Spec:** `docs/superpowers/specs/2026-08-27-outbound-telephony-design.md`

## Global Constraints

- Use `AGENT_STUDIO_V2_BASE_URL="https://api.agora.io/conversational-ai"` and `AGORA_TELEPHONY_PHONE_NUMBER_ID="851"` as server-only configuration.
- Reuse `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`, and `NEXT_PUBLIC_AGORA_APP_ID`; do not add a precomputed authorization variable.
- Do not send `pipeline_id` or `external_agent_id`; send the full normalized `properties` object.
- Never log unmasked Basic Auth, API keys, passwords, RTC tokens, or provider secrets.
- Keep SIP host, username, password, caller number, provider, and transport out of browser requests and UI state.
- Require an authenticated Auth.js session for configuration discovery and outbound dialing.
- Do not place a real outbound call from automated tests; mock the upstream gateway.

---

### Task 1: Telephony contracts and server configuration

**Files:**
- Create: `src/types/telephony.ts`
- Create: `src/server/telephonyConfig.ts`
- Create: `src/server/telephonyConfig.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `OutboundCallRequest`, `OutboundCallOptions`, `OutboundCallResponse`, `TelephonyPublicConfig`, and `TelephonyServerConfig`.
- Produces `readTelephonyConfig(env?: NodeJS.ProcessEnv): TelephonyServerConfig`.
- Produces `buildTelephonyAuthorization(config: TelephonyServerConfig): string`.

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildTelephonyAuthorization,
  readTelephonyConfig,
} from "./telephonyConfig";

const validEnv = {
  AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
  AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
  NEXT_PUBLIC_AGORA_APP_ID: "app-id",
  AGORA_CUSTOMER_ID: "customer",
  AGORA_CUSTOMER_SECRET: "secret",
};

describe("readTelephonyConfig", () => {
  it("parses the verified gateway and phone-number ID", () => {
    expect(readTelephonyConfig(validEnv)).toMatchObject({
      baseUrl: "https://api.agora.io/conversational-ai",
      phoneNumberId: 851,
      appId: "app-id",
    });
  });

  it("rejects a missing phone-number ID", () => {
    expect(() =>
      readTelephonyConfig({
        ...validEnv,
        AGORA_TELEPHONY_PHONE_NUMBER_ID: "",
      }),
    ).toThrow("AGORA_TELEPHONY_PHONE_NUMBER_ID");
  });

  it("builds Basic Auth from customer credentials", () => {
    const config = readTelephonyConfig(validEnv);
    expect(buildTelephonyAuthorization(config)).toBe(
      `Basic ${Buffer.from("customer:secret").toString("base64")}`,
    );
  });
});
```

- [ ] **Step 2: Run the configuration test and confirm it fails**

Run: `npx vitest run src/server/telephonyConfig.test.ts`

Expected: FAIL because `telephonyConfig.ts` and its exports do not exist.

- [ ] **Step 3: Add the typed contracts**

```ts
import type { AgentSettings } from "@/types/agora";

export interface OutboundCallOptions {
  enableRecording: boolean;
  maxDurationSeconds: number;
  maxSilenceDurationMs: number;
  maxRingDurationMs: number;
  idleTimeoutSeconds: number;
}

export interface OutboundCallRequest {
  toNumber: string;
  username: string;
  agentSettings: AgentSettings;
  options: OutboundCallOptions;
}

export interface OutboundCallResponse {
  callId: string;
  agentId?: string;
  status: string;
}

export interface TelephonyPublicConfig {
  configured: boolean;
  phoneNumberId?: number;
}
```

- [ ] **Step 4: Implement strict server configuration parsing**

```ts
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
    throw new Error("AGORA_TELEPHONY_PHONE_NUMBER_ID must be a positive integer");
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
```

- [ ] **Step 5: Run the configuration tests**

Run: `npx vitest run src/server/telephonyConfig.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the contracts and configuration**

```bash
git add .env.example src/types/telephony.ts src/server/telephonyConfig.ts src/server/telephonyConfig.test.ts
git commit -m "feat: add outbound telephony configuration"
```

### Task 2: Shared server credential hydration and telephone properties

**Files:**
- Create: `src/server/agentProviderCredentials.ts`
- Create: `src/server/agentProviderCredentials.test.ts`
- Create: `src/server/telephonyAgentProperties.ts`
- Create: `src/server/telephonyAgentProperties.test.ts`
- Modify: `app/api/agent/invite/route.ts`

**Interfaces:**
- Produces `hydrateAgentProviderCredentials(properties, env?): Record<string, unknown>`.
- Produces `buildTelephonyAgentProperties({ settings, username, env }): Record<string, unknown>`.
- Consumes `buildJoinProperties`, `migrateAgentSettings`, and `validateAgentSettings`.

- [ ] **Step 1: Write failing credential-hydration tests**

```ts
import { describe, expect, it } from "vitest";
import { hydrateAgentProviderCredentials } from "./agentProviderCredentials";

describe("hydrateAgentProviderCredentials", () => {
  it("injects BYOK keys without changing managed providers", () => {
    const byok = hydrateAgentProviderCredentials(
      {
        llm: { vendor: "openai", api_key: "" },
        tts: { vendor: "elevenlabs", params: { key: "" } },
        asr: { vendor: "deepgram", params: { api_key: "" } },
      },
      {
        LLM_API_KEY: "llm-secret",
        ELEVENLABS_API_KEY: "tts-secret",
        DEEPGRAM_API_KEY: "asr-secret",
      },
    );
    expect(byok).toMatchObject({
      llm: { api_key: "llm-secret" },
      tts: { params: { key: "tts-secret" } },
      asr: { params: { api_key: "asr-secret" } },
    });

    const managed = hydrateAgentProviderCredentials({
      llm: { vendor: "openai", credential_mode: "managed", api_key: "" },
    });
    expect(managed).toEqual({
      llm: { vendor: "openai", credential_mode: "managed", api_key: "" },
    });
  });
});
```

- [ ] **Step 2: Write failing telephone-property tests**

```ts
import { describe, expect, it } from "vitest";
import { buildTelephonyAgentProperties } from "./telephonyAgentProperties";

describe("buildTelephonyAgentProperties", () => {
  it("keeps the audio pipeline and removes RTC runtime fields", () => {
    const properties = buildTelephonyAgentProperties({
      settings: {
        name: "agent-test",
        llm: {
          vendor: "openai",
          url: "https://api.openai.com/v1/chat/completions",
          api_key: "",
          params: { model: "gpt-4o-mini" },
        },
        tts: { vendor: "elevenlabs", params: { key: "", voice_id: "voice" } },
        asr: { vendor: "deepgram", params: { api_key: "", model: "nova-3" } },
        advanced_features: { enable_rtm: false, enable_tools: true },
      },
      username: "Bhupendra",
      env: {
        LLM_API_KEY: "llm-secret",
        ELEVENLABS_API_KEY: "tts-secret",
        DEEPGRAM_API_KEY: "asr-secret",
      },
    });
    expect(properties).toMatchObject({
      llm: { template_variables: { username: "Bhupendra" } },
      tts: { params: { key: "tts-secret" } },
      asr: { params: { api_key: "asr-secret" } },
    });
    expect(properties).not.toHaveProperty("channel");
    expect(properties).not.toHaveProperty("token");
    expect(properties).not.toHaveProperty("agent_rtc_uid");
    expect(properties).not.toHaveProperty("remote_rtc_uids");
  });
});
```

- [ ] **Step 3: Run both tests and confirm they fail**

Run: `npx vitest run src/server/agentProviderCredentials.test.ts src/server/telephonyAgentProperties.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement immutable credential hydration**

Implement `hydrateAgentProviderCredentials` by deep-cloning the supplied properties and moving the existing invite-route rules for LLM, MLLM, TTS, ASR, and provider defaults into the new module. Preserve explicit user keys; inject only blank, `__USE_SERVER__`, or `***MASKED***` values. Managed providers must remain keyless. Keep avatar RTC token generation in the invite route because it depends on a live RTC channel.

```ts
import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function shouldInject(value: unknown): boolean {
  const normalized = String(value ?? "").trim();
  return (
    normalized === "" ||
    normalized === "__USE_SERVER__" ||
    normalized === "***MASKED***"
  );
}

export function hydrateAgentProviderCredentials(
  properties: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const hydrated = structuredClone(properties);

  const llm = record(hydrated.llm);
  if (
    llm &&
    llm.credential_mode !== "managed" &&
    shouldInject(llm.api_key)
  ) {
    llm.api_key = env.LLM_API_KEY?.trim() ?? "";
  }

  const mllm = record(hydrated.mllm);
  if (mllm?.enable === true && shouldInject(mllm.api_key)) {
    mllm.api_key =
      String(mllm.vendor ?? "openai") === "gemini"
        ? env.GEMINI_API_KEY?.trim() ?? ""
        : env.OPENAI_API_KEY?.trim() ?? "";
  }

  const tts = record(hydrated.tts);
  const ttsParams = record(tts?.params);
  if (
    tts &&
    ttsParams &&
    tts.credential_mode !== "managed" &&
    tts.vendor !== "generic_http" &&
    shouldInject(ttsParams.key)
  ) {
    const vendor = String(tts.vendor ?? "microsoft");
    const keys: Record<string, string | undefined> = {
      elevenlabs: env.ELEVENLABS_API_KEY,
      openai: env.OPENAI_TTS_KEY,
      deepgram: env.DEEPGRAM_TTS_KEY ?? env.DEEPGRAM_API_KEY,
      microsoft: env.MICROSOFT_TTS_KEY,
    };
    ttsParams.key = keys[vendor]?.trim() ?? "";
  }
  if (
    tts?.vendor === "elevenlabs" &&
    ttsParams &&
    !String(ttsParams.voice_id ?? "").trim()
  ) {
    ttsParams.voice_id =
      env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID?.trim() ||
      ELEVENLABS_DEFAULT_VOICE_ID;
  }

  const asr = record(hydrated.asr);
  const asrParams = record(asr?.params);
  if (
    asr &&
    asrParams &&
    asr.credential_mode !== "managed" &&
    shouldInject(asrParams.api_key ?? asrParams.key)
  ) {
    const vendor = String(asr.vendor ?? "ares");
    if (vendor === "deepgram") {
      asrParams.api_key = env.DEEPGRAM_API_KEY?.trim() ?? "";
    } else if (vendor === "microsoft") {
      asrParams.key = env.MICROSOFT_ASR_KEY?.trim() ?? "";
    } else if (vendor === "gemini") {
      asrParams.api_key = env.GEMINI_API_KEY?.trim() ?? "";
    }
  }

  return hydrated;
}
```

- [ ] **Step 5: Implement telephone property construction**

```ts
import type { AgentSettings } from "@/types/agora";
import { buildJoinProperties, validateAgentSettings } from "@/lib/agora/joinPayload";
import { migrateAgentSettings } from "@/lib/agora/engineConfig";
import { hydrateAgentProviderCredentials } from "./agentProviderCredentials";

export function buildTelephonyAgentProperties(input: {
  settings: AgentSettings;
  username: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, unknown> {
  const settings = migrateAgentSettings(input.settings);
  const validation = validateAgentSettings(settings);
  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(" "));
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
  for (const key of [
    "channel",
    "token",
    "agent_rtc_uid",
    "remote_rtc_uids",
    "enable_string_uid",
  ]) {
    delete properties[key];
  }
  delete properties.avatar;
  return hydrateAgentProviderCredentials(properties, input.env);
}
```

- [ ] **Step 6: Replace invite-route provider hydration with the shared helper**

Import `hydrateAgentProviderCredentials` in `app/api/agent/invite/route.ts`. Apply it to the canonical properties immediately before constructing each final join payload. Remove the duplicated LLM, MLLM, TTS, and ASR key-injection branches after focused invite tests prove equivalent output. Leave avatar token generation and channel-dependent logic in the route.

- [ ] **Step 7: Run shared-property and invite-route tests**

Run: `npx vitest run src/server/agentProviderCredentials.test.ts src/server/telephonyAgentProperties.test.ts app/api/agent/invite/route.test.ts src/lib/agora/joinPayload.test.ts`

Expected: PASS with existing invite behavior unchanged.

- [ ] **Step 8: Commit the shared property pipeline**

```bash
git add src/server/agentProviderCredentials.ts src/server/agentProviderCredentials.test.ts src/server/telephonyAgentProperties.ts src/server/telephonyAgentProperties.test.ts app/api/agent/invite/route.ts
git commit -m "refactor: share agent provider credential hydration"
```

### Task 3: Authenticated outbound-dial API

**Files:**
- Create: `app/api/telephony/config/route.ts`
- Create: `app/api/telephony/config/route.test.ts`
- Create: `app/api/telephony/outbound/route.ts`
- Create: `app/api/telephony/outbound/route.test.ts`
- Create: `src/server/maskSensitive.ts`
- Create: `src/server/maskSensitive.test.ts`

**Interfaces:**
- Produces `GET /api/telephony/config -> TelephonyPublicConfig`.
- Produces `POST /api/telephony/outbound` consuming `OutboundCallRequest` and returning `OutboundCallResponse`.
- Consumes Task 1 configuration and Task 2 property construction.

- [ ] **Step 1: Write failing recursive masking tests**

```ts
import { describe, expect, it } from "vitest";
import { maskSensitive } from "./maskSensitive";

it("masks nested telephone and provider credentials", () => {
  expect(
    maskSensitive({
      authorization: "Basic abc",
      asr: { params: { api_key: "asr-key" } },
      sip: { password: "sip-password" },
    }),
  ).toEqual({
    authorization: "***MASKED***",
    asr: { params: { api_key: "***MASKED***" } },
    sip: { password: "***MASKED***" },
  });
});
```

- [ ] **Step 2: Write failing route tests**

Mock `@/auth`, `global.fetch`, and server configuration. Cover:

```ts
it("rejects unauthenticated calls with 401");
it("rejects a destination that is not E.164 with 400");
it("posts phone_num_id 851 and full properties without pipeline fields");
it("maps upstream failures without exposing authorization or provider keys");
it("returns configured phone-number metadata to authenticated users");
```

The successful fetch assertion must match:

```ts
expect(fetchSpy).toHaveBeenCalledWith(
  "https://api.agora.io/conversational-ai/v2/outbound-dial/app-id",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({
      "Content-Type": "application/json",
      Authorization: expect.stringMatching(/^Basic /),
    }),
    body: expect.any(String),
  }),
);

const upstreamBody = JSON.parse(
  (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
);
expect(upstreamBody).toMatchObject({
  phone_num_id: 851,
  to_number: "+919999999999",
  max_duration_seconds: 300,
  max_silence_duration_ms: 60000,
  max_ring_duration_ms: 30000,
  idle_timeout: 120,
  enable_recording: false,
});
expect(upstreamBody).not.toHaveProperty("pipeline_id");
expect(upstreamBody).not.toHaveProperty("external_agent_id");
```

- [ ] **Step 3: Run route and masking tests and confirm they fail**

Run: `npx vitest run src/server/maskSensitive.test.ts app/api/telephony/config/route.test.ts app/api/telephony/outbound/route.test.ts`

Expected: FAIL because the routes and masking module do not exist.

- [ ] **Step 4: Implement recursive masking**

```ts
const SECRET_KEYS = new Set([
  "authorization",
  "api_key",
  "key",
  "password",
  "token",
  "agora_token",
  "customer_secret",
]);

export function maskSensitive(value: unknown, key = ""): unknown {
  if (SECRET_KEYS.has(key.toLowerCase()) || key.toLowerCase().endsWith("_secret")) {
    return value ? "***MASKED***" : value;
  }
  if (Array.isArray(value)) return value.map((item) => maskSensitive(item));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, child]) => [
      childKey,
      maskSensitive(child, childKey),
    ]),
  );
}
```

- [ ] **Step 5: Implement the protected configuration route**

`GET` calls `auth()`, returns `401` without a session, and otherwise returns `{ configured: true, phoneNumberId: 851 }` from `readTelephonyConfig()`. Configuration errors return `{ configured: false }` with status `200` so the tab can explain that setup is incomplete without exposing credentials.

- [ ] **Step 6: Implement outbound validation and gateway call**

Use `/^\+[1-9]\d{7,14}$/` for E.164. Require integer ranges:

- `maxDurationSeconds`: 1–3600
- `maxSilenceDurationMs`: 1000–300000
- `maxRingDurationMs`: 1000–120000
- `idleTimeoutSeconds`: 1–3600

Construct the upstream object explicitly, call `crypto.randomUUID()` for `call_id`, and return:

```ts
return NextResponse.json({
  callId,
  agentId:
    typeof upstream.agent_id === "string" ? upstream.agent_id : undefined,
  status:
    typeof upstream.status === "string" ? upstream.status : "starting",
});
```

- [ ] **Step 7: Run API tests**

Run: `npx vitest run src/server/maskSensitive.test.ts app/api/telephony/config/route.test.ts app/api/telephony/outbound/route.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the authenticated API**

```bash
git add app/api/telephony src/server/maskSensitive.ts src/server/maskSensitive.test.ts
git commit -m "feat: add authenticated outbound dial API"
```

### Task 4: Telephony client and Settings tab

**Files:**
- Create: `src/api/telephonyApi.ts`
- Create: `src/api/telephonyApi.test.ts`
- Create: `src/components/TelephonySettings.tsx`
- Create: `src/components/TelephonySettings.test.tsx`
- Modify: `src/components/SettingsSidebar.tsx`
- Modify: `src/components/SettingsSidebar.test.tsx`

**Interfaces:**
- Produces `getTelephonyConfig(): Promise<TelephonyPublicConfig>`.
- Produces `startOutboundCall(request: OutboundCallRequest): Promise<OutboundCallResponse>`.
- Produces `TelephonySettings: React.FC` using current Zustand `agentSettings` and `localUsername`.

- [ ] **Step 1: Write failing API-client tests**

```ts
it("loads server telephony configuration", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    Response.json({ configured: true, phoneNumberId: 851 }),
  );
  await expect(getTelephonyConfig()).resolves.toEqual({
    configured: true,
    phoneNumberId: 851,
  });
});

it("posts the typed outbound request", async () => {
  const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
    Response.json({ callId: "call-1", status: "starting" }),
  );
  const request: OutboundCallRequest = {
    toNumber: "+919999999999",
    username: "Bhupendra",
    agentSettings: {
      name: "agent-test",
      llm: {
        vendor: "openai",
        url: "https://api.openai.com/v1/chat/completions",
        api_key: "",
        params: { model: "gpt-4o-mini" },
      },
      tts: { vendor: "elevenlabs", params: { voice_id: "voice" } },
      advanced_features: { enable_rtm: false },
    },
    options: {
      enableRecording: false,
      maxDurationSeconds: 300,
      maxSilenceDurationMs: 60000,
      maxRingDurationMs: 30000,
      idleTimeoutSeconds: 120,
    },
  };
  await startOutboundCall(request);
  expect(fetchSpy).toHaveBeenCalledWith(
    "/api/telephony/outbound",
    expect.objectContaining({ method: "POST" }),
  );
});
```

- [ ] **Step 2: Write failing component tests**

Render `TelephonySettings` with Zustand seeded using `getDefaultSettings()`. Assert:

```ts
expect(await screen.findByText(/Phone-number ID 851/i)).toBeInTheDocument();
expect(screen.getByLabelText(/Destination number/i)).toHaveValue("");
expect(screen.getByLabelText(/Maximum call duration/i)).toHaveValue(300);
expect(screen.getByRole("button", { name: /Make outbound call/i })).toBeDisabled();
```

Enter `+919999999999`, submit, and assert the API receives current `agentSettings`, current username, recording `false`, and the four default timeouts. Add separate assertions for loading, success, and error feedback.

- [ ] **Step 3: Run client and component tests and confirm they fail**

Run: `npx vitest run src/api/telephonyApi.test.ts src/components/TelephonySettings.test.tsx src/components/SettingsSidebar.test.tsx`

Expected: FAIL because Telephony modules and tab do not exist.

- [ ] **Step 4: Implement the API client**

Both functions use same-origin `fetch`, parse safe JSON errors, and throw an `Error` whose message comes from `{ error }` or a stable fallback. Do not accept or return credentials.

- [ ] **Step 5: Implement the focused Telephony component**

Use controlled inputs with these defaults:

```ts
const DEFAULT_OPTIONS: OutboundCallOptions = {
  enableRecording: false,
  maxDurationSeconds: 300,
  maxSilenceDurationMs: 60000,
  maxRingDurationMs: 30000,
  idleTimeoutSeconds: 120,
};
```

Use `showToast` for the call result and also render an inline status panel. Disable submission when the server is not configured, the destination is invalid, no agent settings exist, or a request is already running.

- [ ] **Step 6: Add the Telephony tab**

Update the tab union and tab bar:

```ts
type SettingsTab = "ai-agent" | "voice" | "mcp-server" | "telephony";
```

Add `MdPhone` and render `TelephonySettings` only for `activeTab === "telephony"`. The existing custom-payload disabled state applies to agent-editing tabs but must not prevent making a call with the currently active saved configuration.

- [ ] **Step 7: Run UI tests**

Run: `npx vitest run src/api/telephonyApi.test.ts src/components/TelephonySettings.test.tsx src/components/SettingsSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the Telephony UI**

```bash
git add src/api/telephonyApi.ts src/api/telephonyApi.test.ts src/components/TelephonySettings.tsx src/components/TelephonySettings.test.tsx src/components/SettingsSidebar.tsx src/components/SettingsSidebar.test.tsx
git commit -m "feat: add outbound telephony settings tab"
```

### Task 5: Regression verification and local handoff

**Files:**
- Modify only files required by failures proven in this task.

**Interfaces:**
- Verifies every interface produced by Tasks 1–4.

- [ ] **Step 1: Run focused telephony and invite tests**

Run:

```bash
npx vitest run src/server/telephonyConfig.test.ts src/server/agentProviderCredentials.test.ts src/server/telephonyAgentProperties.test.ts src/server/maskSensitive.test.ts app/api/telephony/config/route.test.ts app/api/telephony/outbound/route.test.ts src/api/telephonyApi.test.ts src/components/TelephonySettings.test.tsx src/components/SettingsSidebar.test.tsx app/api/agent/invite/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js build exits `0` with no TypeScript errors.

- [ ] **Step 4: Check source-control hygiene**

Run:

```bash
git diff --check
git status --short
git diff --cached --check
```

Expected: no whitespace errors, no `.env`, credentials, generated build output, or unrelated files staged.

- [ ] **Step 5: Restart the feature server on port 3000**

Stop the existing feature-server process, confirm `.env -> ../../.env`, and run `npm run dev` from `.worktrees/telephony-outbound`. Confirm Next.js reports `Ready` and the Settings sidebar displays the Telephony tab.

- [ ] **Step 6: Manual outbound-call verification remains user-triggered**

Open Telephony, enter a destination the user controls, and let the user press **Make outbound call**. Verify the server log shows a masked request, the route returns a call ID, and the destination rings. Do not initiate this external telephone call without the user's explicit confirmation at the moment of testing.

- [ ] **Step 7: Commit any verified cleanup**

If Step 1–4 required a proven correction, stage only those corrected files and commit with a message describing that correction. If no correction was required, create no empty commit.
