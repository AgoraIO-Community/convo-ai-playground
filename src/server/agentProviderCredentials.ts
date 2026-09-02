import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";

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

export function hydrateAgentProviderCredentials(
  properties: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const hydrated = JSON.parse(JSON.stringify(properties)) as Record<
    string,
    unknown
  >;

  const llm = asRecord(hydrated.llm);
  if (
    llm &&
    llm.credential_mode !== "managed" &&
    shouldInject(llm.api_key)
  ) {
    llm.api_key = firstValue(env.LLM_API_KEY, env.NEXT_PUBLIC_LLM_API_KEY);
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
