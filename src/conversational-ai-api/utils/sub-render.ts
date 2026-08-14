/**
 * SubRenderController - Handles word-by-word transcript rendering
 * Based on Agora Conversational AI Toolkit reference implementation
 */

import type {
  IAgentTranscription,
  IUserTranscription,
  ITranscriptHelperItem,
} from "@/types/agora";
import { ETurnStatus, ETranscriptRenderMode } from "@/types/agora";
import { ETranscriptHelperMode } from "../type";

export interface SubRenderControllerOptions {
  renderMode: ETranscriptHelperMode | ETranscriptRenderMode;
  enableLog?: boolean;
}

export interface ProcessedMessage {
  item: ITranscriptHelperItem;
  isInProgress: boolean;
}

/**
 * SubRenderController manages transcript rendering modes (WORD, TEXT, AUTO)
 * and processes transcription messages with word-level timing data
 */
export class SubRenderController {
  private renderMode: ETranscriptHelperMode | ETranscriptRenderMode;
  private enableLog: boolean;
  private messageMap: Map<string, ITranscriptHelperItem> = new Map();
  private wordTimers: Map<string, NodeJS.Timeout[]> = new Map();

  constructor(options: SubRenderControllerOptions) {
    this.renderMode =
      options.renderMode ?? ETranscriptHelperMode.UNKNOWN;
    this.enableLog = options.enableLog ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.enableLog) {
      console.log("[SubRenderController]", ...args);
    }
  }

  /**
   * Process a user transcription message
   */
  public processUserTranscription(
    transcription: IUserTranscription,
    _agentRtcUid: string
  ): ProcessedMessage {
    const key = `${transcription.user_id}-${transcription.turn_id}-${transcription.stream_id}`;

    const item: ITranscriptHelperItem = {
      uid: transcription.user_id,
      stream_id: transcription.stream_id,
      turn_id: transcription.turn_id,
      _time: Date.now(),
      text: transcription.text,
      status: transcription.final ? ETurnStatus.END : ETurnStatus.IN_PROGRESS,
      metadata: transcription,
    };

    this.messageMap.set(key, item);

    return {
      item,
      isInProgress: !transcription.final,
    };
  }

  /**
   * Process an agent transcription message
   * Handles word-by-word rendering if word timings are available
   */
  public processAgentTranscription(
    transcription: IAgentTranscription,
    agentRtcUid: string
  ): ProcessedMessage {
    const key = `${agentRtcUid}-${transcription.turn_id}-${transcription.stream_id}`;

    // Determine effective render mode
    const effectiveMode = this.determineEffectiveMode(transcription);

    const item: ITranscriptHelperItem = {
      uid: agentRtcUid,
      stream_id: transcription.stream_id,
      turn_id: transcription.turn_id,
      _time: Date.now(),
      text: transcription.text,
      status: transcription.turn_status,
      metadata: transcription,
    };

    // If WORD mode and we have word timings, we'll handle progressive rendering
    // For now, we store the full text and let the UI handle animation
    // The word timings are available in transcription.words for future enhancement
    if (
      effectiveMode === ETranscriptRenderMode.WORD ||
      effectiveMode === ETranscriptHelperMode.WORD
    ) {
      if (transcription.words && transcription.words.length > 0) {
        this.log(
          `Word-by-word mode: ${transcription.words.length} words with timing data`
        );
        // Word timings are available - UI can use them for progressive rendering
      } else {
        this.log("Word mode requested but no word timings available");
      }
    }

    this.messageMap.set(key, item);

    return {
      item,
      isInProgress: transcription.turn_status === ETurnStatus.IN_PROGRESS,
    };
  }

  /**
   * Determine the effective render mode based on available data
   */
  private determineEffectiveMode(
    transcription: IAgentTranscription
  ): ETranscriptRenderMode | ETranscriptHelperMode {
    // If AUTO mode, check if word timings are available
    if (
      this.renderMode === ETranscriptRenderMode.AUTO ||
      this.renderMode === ETranscriptHelperMode.UNKNOWN
    ) {
      if (transcription.words && transcription.words.length > 0) {
        return ETranscriptRenderMode.WORD;
      }
      return ETranscriptRenderMode.TEXT;
    }

    // If WORD mode but no timings, fall back to TEXT
    if (
      (this.renderMode === ETranscriptRenderMode.WORD ||
        this.renderMode === ETranscriptHelperMode.WORD) &&
      (!transcription.words || transcription.words.length === 0)
    ) {
      this.log("Falling back to TEXT mode - no word timings available");
      return ETranscriptRenderMode.TEXT;
    }

    return this.renderMode as ETranscriptRenderMode;
  }

  /**
   * Mark a message as interrupted
   */
  public markInterrupted(turnId: number): void {
    this.messageMap.forEach((item) => {
      if (item.turn_id === turnId && item.status === ETurnStatus.IN_PROGRESS) {
        item.status = ETurnStatus.INTERRUPTED;
      }
    });
  }

  /**
   * Get all processed messages
   */
  public getAllMessages(): ITranscriptHelperItem[] {
    return Array.from(this.messageMap.values());
  }

  /**
   * Get the latest in-progress message
   */
  public getCurrentInProgressMessage(): ITranscriptHelperItem | null {
    const inProgressMessages = Array.from(this.messageMap.values()).filter(
      (item) => item.status === ETurnStatus.IN_PROGRESS
    );

    if (inProgressMessages.length === 0) {
      return null;
    }

    // Return the most recent one (highest turn_id)
    return inProgressMessages.reduce((latest, current) => {
      return current.turn_id > latest.turn_id ? current : latest;
    });
  }

  /**
   * Clear all messages
   */
  public clear(): void {
    // Clear any active timers
    this.wordTimers.forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    this.wordTimers.clear();
    this.messageMap.clear();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.clear();
  }
}
