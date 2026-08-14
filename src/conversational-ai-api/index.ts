/**
 * ConversationalAIAPI - Official Agora Web toolkit for live transcripts
 * Based on: https://docs.agora.io/en/conversational-ai/develop/transcripts
 *
 * Usage:
 * 1. ConversationalAIAPI.init({ rtcEngine, rtmEngine, renderMode, enableLog })
 * 2. api.subscribeMessage(channelName) - call before starting agent
 * 3. api.on(EConversationalAIAPIEvents.TRANSCRIPT_UPDATED, (chatHistory) => {...})
 * 4. api.unsubscribe() - after agent session ends
 * 5. api.destroy() - at end of call
 */

import type { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import {
  EConversationalAIAPIEvents,
  ETranscriptHelperMode,
  ERTCEvents,
  ERTMEvents,
  EMessageType,
  EChatMessageType,
  NotFoundError,
} from "./type";
import type { IChatMessageText, IChatMessageImage } from "./type";

export { EConversationalAIAPIEvents, EChatMessageType } from "./type";
export type { IChatMessageText, IChatMessageImage } from "./type";
import type {
  ITranscriptHelperItem,
  IUserTranscription,
  IAgentTranscription,
} from "@/types/agora";
import { ETurnStatus } from "@/types/agora";
import { EventHelper } from "./utils/events";
import { SubRenderController } from "./utils/sub-render";

export interface IConversationalAIAPIConfig {
  rtcEngine: IAgoraRTCClient;
  rtmEngine: unknown; // agora-rtm-sdk RTM client
  renderMode?: ETranscriptHelperMode;
  enableLog?: boolean;
  enableRenderModeFallback?: boolean;
}

const TAG = "ConversationalAIAPI";

/**
 * Conversational AI API - manages transcript subscription and events.
 * Follows the official Agora implementation pattern.
 */
export class ConversationalAIAPI extends EventHelper {
  private static _instance: ConversationalAIAPI | null = null;

  protected rtcEngine: IAgoraRTCClient | null = null;
  protected rtmEngine: unknown = null;
  protected renderMode: ETranscriptHelperMode = ETranscriptHelperMode.UNKNOWN;
  protected channel: string | null = null;
  protected enableLog: boolean = false;
  protected agentRtcUid: string = "0";

  private subRenderController: SubRenderController | null = null;
  private handleStreamMessage: ((uid: number | string, data: Uint8Array) => void) | null = null;
  private handleRTMMessage: ((event: unknown) => void) | null = null;
  private handleRTMPresence: ((event: unknown) => void) | null = null;

  // Chunk cache for RTC datastream messages (format: message_id|chunk_index|total_chunks|base64)
  private chunkCache: Map<
    string,
    { chunks: Map<number, string>; total: number; lastSeen: number }
  > = new Map();
  private readonly CHUNK_TIMEOUT_MS = 10000; // 10 seconds

  public static init(cfg: IConversationalAIAPIConfig): ConversationalAIAPI {
    if (!ConversationalAIAPI._instance) {
      ConversationalAIAPI._instance = new ConversationalAIAPI();
    }
    ConversationalAIAPI._instance.rtcEngine = cfg.rtcEngine;
    ConversationalAIAPI._instance.rtmEngine = cfg.rtmEngine;
    ConversationalAIAPI._instance.renderMode =
      cfg.renderMode ?? ETranscriptHelperMode.UNKNOWN;
    ConversationalAIAPI._instance.enableLog = cfg.enableLog ?? false;

    if (ConversationalAIAPI._instance.enableLog) {
      console.log(
        `[${TAG}] init renderMode=${ConversationalAIAPI._instance.renderMode}`
      );
    }

    return ConversationalAIAPI._instance;
  }

  public static getInstance(): ConversationalAIAPI {
    if (!ConversationalAIAPI._instance) {
      throw new NotFoundError("ConversationalAIAPI is not initialized");
    }
    return ConversationalAIAPI._instance;
  }

  public setAgentRtcUid(uid: string): void {
    this.agentRtcUid = uid;
  }

  /**
   * Send chat messages to the conversational agent (text or image by URL).
   * For IMAGE: sends a small RTM payload { uuid, url }; the engine fetches the image from the URL.
   * For TEXT: sends user.transcription format.
   */
  public async chat(
    agentUserId: string,
    message: IChatMessageText | IChatMessageImage
  ): Promise<void> {
    const rtm = this.rtmEngine as {
      publish: (
        userId: string,
        message: string,
        options?: { channelType?: string; customType?: string }
      ) => Promise<void>;
    } | null;
    if (!rtm || typeof rtm.publish !== "function") {
      throw new Error("ConversationalAIAPI: RTM engine not available or missing publish");
    }

    if (message.messageType === EChatMessageType.IMAGE) {
      const img = message as IChatMessageImage;
      if (!img.url) {
        throw new Error("ConversationalAIAPI: IMAGE message must include url");
      }
      const payload = { uuid: img.uuid, url: img.url };
      if (this.enableLog) {
        console.log(`[${TAG}] chat IMAGE to ${agentUserId} uuid=${img.uuid}`);
      }
      await rtm.publish(agentUserId, JSON.stringify(payload), {
        channelType: "USER",
        customType: "image.upload",
      });
    } else if (message.messageType === EChatMessageType.TEXT) {
      const textMsg = message as IChatMessageText;
      const payload = {
        priority: "interrupted",
        interruptable: true,
        message: textMsg.text ?? "",
      };
      if (this.enableLog) {
        console.log(`[${TAG}] chat TEXT to ${agentUserId}`);
      }
      await rtm.publish(agentUserId, JSON.stringify(payload), {
        channelType: "USER",
        customType: "user.transcription",
      });
    } else {
      throw new Error(`ConversationalAIAPI: unsupported message type`);
    }
  }

  /**
   * Subscribe to channel messages - call before starting agent session.
   * Transcript data is delivered via RTC stream-message (RTC mode) or RTM (RTM mode).
   */
  public subscribeMessage(channelName: string): void {
    if (this.enableLog) {
      console.log(`[${TAG}] subscribeMessage channel=${channelName}`);
    }

    this.channel = channelName;

    // Create SubRenderController
    this.subRenderController = new SubRenderController({
      renderMode: this.renderMode,
      enableLog: this.enableLog,
    });

    // Bind RTC events (stream-message for RTC mode, audio-pts for word sync)
    this.bindRtcEvents();

    // Bind RTM events (for RTM mode transcripts)
    this.bindRtmEvents();
  }

  /**
   * Unsubscribe from channel and cleanup.
   */
  public unsubscribe(): void {
    if (this.enableLog) {
      console.log(`[${TAG}] unsubscribe channel=${this.channel}`);
    }

    this.unbindRtcEvents();
    this.unbindRtmEvents();
    this.channel = null;

    // Clear chunk cache
    this.chunkCache.clear();

    if (this.subRenderController) {
      this.subRenderController.destroy();
      this.subRenderController = null;
    }
  }

  /**
   * Destroy the instance.
   */
  public destroy(): void {
    const instance = ConversationalAIAPI._instance;
    if (instance) {
      instance.unsubscribe();
      instance.rtcEngine?.removeAllListeners?.();
      instance.rtcEngine = null;
      instance.rtmEngine = null;
      instance.removeAllEventListeners();
      ConversationalAIAPI._instance = null;
    }
    if (this.enableLog) {
      console.log(`[${TAG}] destroy`);
    }
  }

  private bindRtcEvents(): void {
    if (!this.rtcEngine || !this.subRenderController) return;

    this.handleStreamMessage = (uid: number | string, data: Uint8Array) => {
      try {
        const decoder = new TextDecoder("utf-8");
        const messageString = decoder.decode(data);

        if (this.enableLog) {
          console.log(`[${TAG}] RTC stream-message from ${uid}:`, messageString.substring(0, 200));
        }

        const trimmed = messageString.trim();

        // Check if it's plain JSON (RTM-style over RTC or legacy format)
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const message = JSON.parse(messageString) as Record<string, unknown>;
          if (this.enableLog) {
            console.log(`[${TAG}] RTC parsed JSON message - object:`, message.object, "turn_id:", message.turn_id);
          }
          this.processMessage(message, String(uid));
          return;
        }

        // Check if it's chunked format: message_id|chunk_index|total_chunks|base64_payload
        if (messageString.includes("|")) {
          this.handleChunkedMessage(messageString, String(uid));
          return;
        }

        // Unknown format - skip
        if (this.enableLog) {
          console.log(`[${TAG}] RTC unknown message format, skipping`);
        }
      } catch (e) {
        if (this.enableLog) console.warn(`[${TAG}] RTC parse error:`, e);
      }
    };

    this.rtcEngine.on(ERTCEvents.STREAM_MESSAGE, this.handleStreamMessage);

    // Clean up stale chunks periodically
    this.cleanupChunkCache();

    if (this.enableLog) {
      console.log(`[${TAG}] Bound RTC stream-message listener`);
    }
  }

  /**
   * Handle RTC datastream chunked messages (format: message_id|chunk_index|total_chunks|base64_payload)
   */
  private handleChunkedMessage(messageString: string, uid: string): void {
    try {
      const parts = messageString.split("|");
      if (parts.length !== 4) {
        if (this.enableLog) {
          console.log(`[${TAG}] RTC chunked message invalid format (expected 4 parts, got ${parts.length})`);
        }
        return;
      }

      const [messageId, chunkIndexStr, totalChunksStr, base64Payload] = parts;
      const chunkIndex = parseInt(chunkIndexStr, 10);
      const totalChunks = parseInt(totalChunksStr, 10);

      if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 1 || totalChunks < 1) {
        if (this.enableLog) {
          console.log(`[${TAG}] RTC chunked message invalid indices: chunk=${chunkIndexStr}, total=${totalChunksStr}`);
        }
        return;
      }

      // Single chunk - decode and process immediately
      if (totalChunks === 1) {
        try {
          const decoded = atob(base64Payload);
          const message = JSON.parse(decoded) as Record<string, unknown>;
          if (this.enableLog) {
            console.log(`[${TAG}] RTC single-chunk message decoded - object:`, message.object, "turn_id:", message.turn_id);
          }
          this.processMessage(message, uid);
        } catch (e) {
          if (this.enableLog) console.warn(`[${TAG}] RTC single-chunk decode/parse error:`, e);
        }
        return;
      }

      // Multi-chunk - cache and reassemble
      const cacheKey = `${uid}-${messageId}`;
      let cache = this.chunkCache.get(cacheKey);

      if (!cache) {
        cache = {
          chunks: new Map<number, string>(),
          total: totalChunks,
          lastSeen: Date.now(),
        };
        this.chunkCache.set(cacheKey, cache);
      }

      // Update cache
      cache.chunks.set(chunkIndex, base64Payload);
      cache.lastSeen = Date.now();

      if (this.enableLog) {
        console.log(`[${TAG}] RTC chunk ${chunkIndex}/${totalChunks} received for message ${messageId}`);
      }

      // Check if all chunks received
      if (cache.chunks.size === totalChunks) {
        try {
          // Reassemble: decode each chunk and concatenate
          const decodedChunks: string[] = [];
          for (let i = 1; i <= totalChunks; i++) {
            const chunkBase64 = cache.chunks.get(i);
            if (!chunkBase64) {
              if (this.enableLog) {
                console.warn(`[${TAG}] RTC missing chunk ${i}/${totalChunks} for message ${messageId}`);
              }
              return; // Wait for missing chunk
            }
            decodedChunks.push(atob(chunkBase64));
          }

          // Concatenate and parse JSON
          const fullMessage = decodedChunks.join("");
          const message = JSON.parse(fullMessage) as Record<string, unknown>;

          if (this.enableLog) {
            console.log(`[${TAG}] RTC multi-chunk message reassembled - object:`, message.object, "turn_id:", message.turn_id);
          }

          // Process and clean up cache
          this.processMessage(message, uid);
          this.chunkCache.delete(cacheKey);
        } catch (e) {
          if (this.enableLog) console.warn(`[${TAG}] RTC multi-chunk reassemble/parse error:`, e);
          this.chunkCache.delete(cacheKey); // Clean up on error
        }
      }
    } catch (e) {
      if (this.enableLog) console.warn(`[${TAG}] RTC chunked message handling error:`, e);
    }
  }

  /**
   * Clean up stale chunk cache entries
   */
  private cleanupChunkCache(): void {
    const now = Date.now();
    for (const [key, cache] of this.chunkCache.entries()) {
      if (now - cache.lastSeen > this.CHUNK_TIMEOUT_MS) {
        if (this.enableLog) {
          console.log(`[${TAG}] Cleaning up stale chunk cache entry: ${key}`);
        }
        this.chunkCache.delete(key);
      }
    }
  }

  private unbindRtcEvents(): void {
    if (this.rtcEngine && this.handleStreamMessage) {
      this.rtcEngine.off(ERTCEvents.STREAM_MESSAGE, this.handleStreamMessage);
      this.handleStreamMessage = null;
    }
  }

  private bindRtmEvents(): void {
    const rtm = this.rtmEngine as {
      addEventListener?: (event: string, handler: (e: unknown) => void) => void;
      removeEventListener?: (event: string, handler: (e: unknown) => void) => void;
    };

    if (!rtm?.addEventListener || !this.subRenderController) return;

    this.handleRTMMessage = (event: unknown) => {
      try {
        const e = event as {
          message?: unknown;
          publisher?: string;
          channelName?: string;
          channelType?: string;
          messageType?: string;
        };

        if (this.enableLog) {
          console.log(`[${TAG}] RTM message event received:`, {
            publisher: e.publisher,
            channelName: e.channelName,
            channelType: e.channelType,
            messageType: e.messageType,
          });
        }

        const messageData = e.message;
        if (!messageData) {
          if (this.enableLog) console.log(`[${TAG}] RTM message has no message data`);
          return;
        }

        // Parse message - following official Agora toolkit pattern
        let parsed: Record<string, unknown>;

        if (typeof messageData === "string") {
          if (this.enableLog) {
            console.log(`[${TAG}] RTM string message:`, messageData.substring(0, 200));
          }
          parsed = JSON.parse(messageData);
        } else if (messageData instanceof Uint8Array) {
          const decoder = new TextDecoder("utf-8");
          const messageString = decoder.decode(messageData);
          if (this.enableLog) {
            console.log(`[${TAG}] RTM Uint8Array message:`, messageString.substring(0, 200));
          }
          parsed = JSON.parse(messageString);
        } else if (messageData && typeof messageData === "object") {
          // Already an object
          parsed = messageData as Record<string, unknown>;
          if (this.enableLog) {
            console.log(`[${TAG}] RTM object message:`, parsed);
          }
        } else {
          if (this.enableLog) {
            console.log(`[${TAG}] RTM unsupported message type:`, typeof messageData);
          }
          return;
        }

        if (this.enableLog) {
          console.log(`[${TAG}] RTM parsed message - object:`, parsed.object, "turn_id:", parsed.turn_id);
        }

        this.processMessage(parsed, e.publisher || "unknown");
      } catch (err) {
        if (this.enableLog) console.warn(`[${TAG}] RTM parse error:`, err);
      }
    };

    this.handleRTMPresence = (event: unknown) => {
      try {
        const e = event as { stateChanged?: { state?: string } };
        if (e.stateChanged?.state) {
          this.emit(
            EConversationalAIAPIEvents.AGENT_STATE_CHANGED,
            this.agentRtcUid,
            {
              state: e.stateChanged.state,
              turnID: 0,
              timestamp: Date.now(),
              reason: "",
            }
          );
        }
      } catch {
        // Ignore parse errors for non-transcript messages
      }
    };

    rtm.addEventListener(ERTMEvents.MESSAGE, this.handleRTMMessage);
    rtm.addEventListener(ERTMEvents.PRESENCE, this.handleRTMPresence);

    if (this.enableLog) {
      console.log(`[${TAG}] Bound RTM event listeners for channel=${this.channel}`);
    }
  }

  private unbindRtmEvents(): void {
    const rtm = this.rtmEngine as {
      removeEventListener?: (event: string, handler: (e: unknown) => void) => void;
    };

    if (rtm?.removeEventListener) {
      if (this.handleRTMMessage) {
        rtm.removeEventListener(ERTMEvents.MESSAGE, this.handleRTMMessage);
        this.handleRTMMessage = null;
      }
      if (this.handleRTMPresence) {
        rtm.removeEventListener(ERTMEvents.PRESENCE, this.handleRTMPresence);
        this.handleRTMPresence = null;
      }
    }
  }

  private processMessage(
    message: Record<string, unknown>,
    _publisher?: string
  ): void {
    if (!this.subRenderController) return;

    const msgType = message.object as string | undefined;

    if (this.enableLog) {
      console.log(`[${TAG}] Processing message type="${msgType}"`, message);
    }

    if (msgType === EMessageType.USER_TRANSCRIPTION) {
      const userMsg = message as unknown as IUserTranscription;
      if (this.enableLog) {
        console.log(`[${TAG}] User transcription:`, userMsg.text, `final=${userMsg.final}`);
      }
      this.subRenderController.processUserTranscription(
        userMsg,
        userMsg.user_id
      );
    } else if (msgType === EMessageType.AGENT_TRANSCRIPTION) {
      const agentMsg = message as unknown as IAgentTranscription;
      if (this.enableLog) {
        console.log(`[${TAG}] Agent transcription:`, agentMsg.text, `turn_status=${agentMsg.turn_status}`);
      }
      this.subRenderController.processAgentTranscription(
        agentMsg,
        this.agentRtcUid
      );
    } else if (msgType === EMessageType.MSG_INTERRUPTED) {
      const turnId = message.turn_id as number;
      if (this.enableLog) {
        console.log(`[${TAG}] Message interrupted, turnId=${turnId}`);
      }
      this.subRenderController.markInterrupted(turnId);
    } else {
      if (this.enableLog) {
        console.log(`[${TAG}] Unknown message type:`, msgType);
      }
    }

    this.emitTranscriptUpdated();
  }

  private emitTranscriptUpdated(): void {
    if (!this.subRenderController) return;

    const all = this.subRenderController.getAllMessages();
    const inProgress = this.subRenderController.getCurrentInProgressMessage();

    const completed = all.filter((m) => m.status !== ETurnStatus.IN_PROGRESS);
    completed.sort((a, b) => a.turn_id - b.turn_id);

    const toEmit: ITranscriptHelperItem[] = [...completed];
    if (inProgress) {
      toEmit.push(inProgress);
    }

    this.emit(EConversationalAIAPIEvents.TRANSCRIPT_UPDATED, toEmit);
  }
}
