import type { EConversationalAIAPIEvents } from "../type";

export class EventHelper {
  private listeners: Map<
    EConversationalAIAPIEvents,
    Array<(...args: unknown[]) => void>
  > = new Map();

  public on(
    event: EConversationalAIAPIEvents,
    handler: (...args: unknown[]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  public off(
    event: EConversationalAIAPIEvents,
    handler: (...args: unknown[]) => void
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  protected emit(event: EConversationalAIAPIEvents, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  public removeAllEventListeners(): void {
    this.listeners.clear();
  }
}
