import type { SSEEvent } from "@/types/call.types";

export class SSEStream {
  private encoder = new TextEncoder();
  private stream: ReadableStream<Uint8Array>;
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private closed = false;

  constructor() {
    this.stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.closed = true;
      },
    });
  }

  sendEvent<T>(event: SSEEvent<T>): void {
    if (this.closed || !this.controller) return;

    try {
      const data = `event: ${event.type}\ndata: ${JSON.stringify(
        event.data
      )}\nid: ${event.timestamp}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (error) {
      console.error("Error sending SSE event:", error);
    }
  }

  sendHeartbeat(): void {
    if (this.closed || !this.controller) return;

    try {
      const data = `: heartbeat\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (error) {
      console.error("Error sending heartbeat:", error);
    }
  }

  close(): void {
    if (this.closed || !this.controller) return;

    try {
      this.controller.close();
      this.closed = true;
    } catch (error) {
      console.error("Error closing SSE stream:", error);
    }
  }

  getStream(): ReadableStream<Uint8Array> {
    return this.stream;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

export function createSSEResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(private url: string) {}

  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(this.url);

    this.eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      this.emit("error", { error: "Connection failed" });
    };

    this.listeners.forEach((_, eventType) => {
      this.eventSource?.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(eventType, data);
        } catch (error) {
          console.error(`Error parsing SSE event ${eventType}:`, error);
        }
      });
    });
  }

  on(eventType: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());

      if (this.eventSource) {
        this.eventSource.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit(eventType, data);
          } catch (error) {
            console.error(`Error parsing SSE event ${eventType}:`, error);
          }
        });
      }
    }

    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: (data: unknown) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  private emit(eventType: string, data: unknown): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}
