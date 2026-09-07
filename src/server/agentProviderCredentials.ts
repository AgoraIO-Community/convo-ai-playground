import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";
import { appendGeminiApiKey } from "@/lib/agora/llmProviderUrls";

function asRecord(value: unknown): Record<string, unknown> | undefined {
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

function firstValue(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function normalizeGeminiSystemMessages(llm: Record<string, unknown>): void {
  if (!Array.isArray(llm.system_messages)) return;

  llm.system_messages = llm.system_messages.map((message) => {
    const record = asRecord(message);
    if (!record || Array.isArray(record.parts)) return message;
    if (typeof record.content !== "string") return message;

    return {
      role: record.role === "system" ? "user" : record.role,
      parts: [{ text: record.content }],
    };
  });
}

export function hydrateAgentProviderCredentials(
  properties: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const hydrated = JSON.parse(JSON.stringify(properties)) as Record<
    string,
    unknown
  >;

  const llm = asRecord(hydrated.llm);
  if (llm) {
    const providerConfig = asRecord(llm.provider_config);
    const isBedrock =
      providerConfig?.provider === "amazon_bedrock" || llm.style === "bedrock";
    const isVertex =
      providerConfig?.provider === "google_vertex_ai" ||
      String(llm.url ?? "").includes("aiplatform.googleapis.com");
    const isNativeGemini =
      llm.style === "gemini" &&
      String(llm.url ?? "").includes("generativelanguage.googleapis.com");
    const isNativeAnthropic = llm.style === "anthropic";
    const isNativeDify = llm.style === "dify";
    const isNativeGroq = String(llm.url ?? "").includes("api.groq.com");

    if (llm.credential_mode !== "managed") {
      if (shouldInject(llm.api_key)) {
        llm.api_key = isBedrock
          ? firstValue(env.BEDROCK_API_KEY)
          : isVertex
            ? firstValue(env.GOOGLE_VERTEX_ACCESS_TOKEN, env.LLM_API_KEY)
            : isNativeGemini
              ? firstValue(env.GEMINI_API_KEY, env.LLM_API_KEY)
              : firstValue(env.LLM_API_KEY, env.NEXT_PUBLIC_LLM_API_KEY);
      }
      if (isNativeGemini && !shouldInject(llm.api_key)) {
        llm.url = appendGeminiApiKey(
          String(llm.url ?? ""),
          String(llm.api_key),
        );
        delete llm.api_key;
      }
      if (isNativeGemini || isVertex) {
        normalizeGeminiSystemMessages(llm);

        // These fields select playground credential/UI behavior. Sending
        // vendor="custom" opts Agora into its custom-LLM request envelope,
        // which Google's native APIs reject because it adds metadata fields.
        delete llm.vendor;
        delete llm.credential_mode;
      }
      if (isBedrock) {
        if (!shouldInject(llm.api_key)) {
          delete llm.access_key;
          delete llm.secret_key;
        } else {
          delete llm.api_key;
          if (shouldInject(llm.access_key)) {
            llm.access_key = firstValue(env.BEDROCK_AWS_ACCESS_KEY_ID);
          }
          if (shouldInject(llm.secret_key)) {
            llm.secret_key = firstValue(env.BEDROCK_AWS_SECRET_ACCESS_KEY);
          }
        }

        delete llm.vendor;
        delete llm.credential_mode;

        const params = asRecord(llm.params);
        if (shouldInject(llm.model) && params?.model) {
          llm.model = String(params.model);
        }
        if (params) {
          delete params.model;
          if (Object.keys(params).length === 0) delete llm.params;
        }
      }
      if (isNativeAnthropic || isNativeDify || isNativeGroq) {
        delete llm.vendor;
        delete llm.credential_mode;
      }
    }

    // Used only by the settings UI; it is not part of Agora's join schema.
    delete llm.provider_config;
  }

  const mllm = asRecord(hydrated.mllm);
  if (mllm?.enable === true && shouldInject(mllm.api_key)) {
    mllm.api_key =
      String(mllm.vendor ?? "openai") === "gemini"
        ? firstValue(env.GEMINI_API_KEY, env.NEXT_PUBLIC_GEMINI_API_KEY)
        : firstValue(env.OPENAI_API_KEY, env.NEXT_PUBLIC_OPENAI_API_KEY);
  }

  const tts = asRecord(hydrated.tts);
  const ttsParams = asRecord(tts?.params);
  const ttsVendor = String(tts?.vendor ?? "microsoft");
  if (tts && ttsParams && ttsVendor === "sarvam") {
    const configuredCredential = !shouldInject(ttsParams.key)
      ? String(ttsParams.key)
      : !shouldInject(ttsParams.api_subscription_key)
        ? String(ttsParams.api_subscription_key)
        : firstValue(env.SARVAM_TTS_KEY, env.SARVAM_API_KEY);

    ttsParams.api_subscription_key = configuredCredential;
    delete ttsParams.key;
  } else if (
    tts &&
    ttsParams &&
    ttsVendor === "minimax" &&
    tts.credential_mode !== "managed"
  ) {
    if (shouldInject(ttsParams.key)) {
      ttsParams.key = firstValue(env.MINIMAX_API_KEY);
    }
    if (shouldInject(ttsParams.group_id)) {
      ttsParams.group_id = firstValue(env.MINIMAX_GROUP_ID);
    }
  } else if (
    tts &&
    ttsParams &&
    tts.credential_mode !== "managed" &&
    tts.vendor !== "generic_http" &&
    shouldInject(ttsParams.key)
  ) {
    const vendor = ttsVendor;
    if (vendor === "elevenlabs") {
      ttsParams.key = firstValue(
        env.ELEVENLABS_API_KEY,
        env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      );
    } else if (vendor === "openai") {
      ttsParams.key = firstValue(
        env.OPENAI_TTS_KEY,
        env.NEXT_PUBLIC_OPENAI_TTS_KEY,
      );
    } else if (vendor === "deepgram") {
      ttsParams.key = firstValue(
        env.DEEPGRAM_TTS_KEY,
        env.DEEPGRAM_API_KEY,
        env.NEXT_PUBLIC_DEEPGRAM_API_KEY,
      );
    } else if (vendor === "microsoft") {
      ttsParams.key = firstValue(
        env.MICROSOFT_TTS_KEY,
        env.NEXT_PUBLIC_MICROSOFT_TTS_KEY,
      );
    }
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

  const asr = asRecord(hydrated.asr);
  const asrParams = asRecord(asr?.params);
  if (
    asr &&
    asrParams &&
    asr.credential_mode !== "managed" &&
    shouldInject(asrParams.api_key ?? asrParams.key)
  ) {
    const vendor = String(asr.vendor ?? "ares");
    if (vendor === "deepgram") {
      asrParams.api_key = firstValue(
        env.DEEPGRAM_API_KEY,
        env.NEXT_PUBLIC_DEEPGRAM_API_KEY,
      );
    } else if (vendor === "microsoft") {
      asrParams.key = firstValue(
        env.MICROSOFT_ASR_KEY,
        env.NEXT_PUBLIC_MICROSOFT_ASR_KEY,
      );
    } else if (vendor === "gemini") {
      asrParams.api_key = firstValue(env.GEMINI_API_KEY);
    } else if (vendor === "openai") {
      asrParams.api_key = firstValue(env.OPENAI_ASR_KEY, env.OPENAI_API_KEY);
    }
  }

  return hydrated;
}
