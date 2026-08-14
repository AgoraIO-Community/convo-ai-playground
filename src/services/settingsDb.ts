/**
 * IndexedDB persistence for Settings panel (AI Agent, Voice, MCP Server).
 * Zustand remains the source of truth; this module handles load/save only.
 */

import type { AgentSettings } from "@/types/agora";

const DB_NAME = "MyAgoraAppSettings";
const DB_VERSION = 1;
const STORE_NAME = "settings";

export interface VoiceSettingsPayload {
  selectedMicrophoneId: string | null;
}

type SettingsId = "agent" | "voice" | "customAgent";

export interface CustomAgentSettingsPayload {
  useCustomPayload: boolean;
  customPayloadJson: string;
}

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Get stored agent settings (AI Agent + MCP Server tab data).
 */
export async function getAgentSettings(): Promise<AgentSettings | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get("agent" as unknown as IDBValidKey);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        const row = request.result as
          | { id: SettingsId; value: AgentSettings }
          | undefined;
        resolve(row?.value ?? null);
      };
    });
  } catch (err) {
    console.error("[settingsDb] getAgentSettings failed:", err);
    return null;
  }
}

const MASKED_PLACEHOLDER = "***MASKED***";

/** Clone settings and mask API key fields so they are never persisted. */
function maskKeysForPersistence(settings: AgentSettings): AgentSettings {
  const out = JSON.parse(JSON.stringify(settings)) as AgentSettings;
  if (out.llm?.api_key?.trim()) out.llm.api_key = MASKED_PLACEHOLDER;
  if (out.mllm?.api_key?.trim()) out.mllm.api_key = MASKED_PLACEHOLDER;
  if (out.tts?.params && typeof out.tts.params === "object") {
    const p = out.tts.params as Record<string, unknown>;
    if (String(p.key ?? "").trim()) p.key = MASKED_PLACEHOLDER;
  }
  if (out.asr?.params && typeof out.asr.params === "object") {
    const p = out.asr.params as Record<string, unknown>;
    if (String(p.api_key ?? "").trim()) p.api_key = MASKED_PLACEHOLDER;
    if (String(p.key ?? "").trim()) p.key = MASKED_PLACEHOLDER;
  }
  if (out.avatar?.params && typeof out.avatar.params === "object") {
    const p = out.avatar.params as unknown as Record<string, unknown>;
    if (String(p.api_key ?? "").trim()) p.api_key = MASKED_PLACEHOLDER;
  }
  return out;
}

/**
 * Persist agent settings to IndexedDB. API keys are masked before writing.
 */
export async function setAgentSettings(settings: AgentSettings): Promise<void> {
  if (!isBrowser()) return;
  try {
    const toStore = maskKeysForPersistence(settings);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id: "agent", value: toStore });
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.error("[settingsDb] setAgentSettings failed:", err);
  }
}

/**
 * Get stored voice settings (Voice tab: selected microphone).
 */
export async function getVoiceSettings(): Promise<VoiceSettingsPayload | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get("voice" as unknown as IDBValidKey);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        const row = request.result as
          | { id: SettingsId; value: VoiceSettingsPayload }
          | undefined;
        resolve(row?.value ?? null);
      };
    });
  } catch (err) {
    console.error("[settingsDb] getVoiceSettings failed:", err);
    return null;
  }
}

/**
 * Persist voice settings to IndexedDB.
 */
export async function setVoiceSettings(
  voice: VoiceSettingsPayload,
): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id: "voice", value: voice });
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.error("[settingsDb] setVoiceSettings failed:", err);
  }
}

/**
 * Get stored custom agent settings (toggle + masked JSON). Never contains real API keys.
 */
export async function getCustomAgentSettings(): Promise<CustomAgentSettingsPayload | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get("customAgent" as unknown as IDBValidKey);
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        const row = request.result as
          | { id: SettingsId; value: CustomAgentSettingsPayload }
          | undefined;
        resolve(row?.value ?? null);
      };
    });
  } catch (err) {
    console.error("[settingsDb] getCustomAgentSettings failed:", err);
    return null;
  }
}

/**
 * Persist custom agent settings. customPayloadJson must already be masked (no real keys).
 */
export async function setCustomAgentSettings(
  payload: CustomAgentSettingsPayload,
): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id: "customAgent", value: payload });
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.error("[settingsDb] setCustomAgentSettings failed:", err);
  }
}
