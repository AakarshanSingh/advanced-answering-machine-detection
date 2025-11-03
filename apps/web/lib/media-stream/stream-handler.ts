import { connectionManager } from "./connection-manager";
import { AudioBridge } from "./audio-bridge";

interface StreamMessage {
  event: string;
  streamSid?: string;
  callSid?: string;
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  start?: {
    streamSid: string;
    callSid: string;
    tracks: string[];
    customParameters?: Record<string, string>;
  };
}

class StreamHandler {
  private ws: WebSocket;
  private callSid: string | null = null;
  private streamSid: string | null = null;
  private role: "caller" | "agent" = "caller";
  private bridge: AudioBridge | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.initialize();
  }

  private initialize(): void {
    this.ws.addEventListener("message", this.handleMessage.bind(this));
    this.ws.addEventListener("close", this.handleClose.bind(this));
    this.ws.addEventListener("error", this.handleError.bind(this));
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const message: StreamMessage = JSON.parse(event.data.toString());

      switch (message.event) {
        case "connected":
          this.handleConnected();
          break;
        case "start":
          await this.handleStart(message);
          break;
        case "media":
          this.handleMedia(message);
          break;
        case "stop":
          this.handleStop();
          break;
      }
    } catch (error) {
      console.error("Error handling stream message:", error);
    }
  }

  private handleConnected(): void {
    console.log("Stream WebSocket connected");
  }

  private async handleStart(message: StreamMessage): Promise<void> {
    if (!message.start) return;

    this.callSid = message.start.callSid;
    this.streamSid = message.start.streamSid;

    const customParams = message.start.customParameters;
    if (customParams?.role === "agent") {
      this.role = "agent";
    }

    connectionManager.addConnection(this.callSid, {
      ws: this.ws,
      callSid: this.callSid,
      streamSid: this.streamSid,
      role: this.role,
    });

    console.log(`Stream started: ${this.role} - ${this.callSid}`);

    await this.attemptPairing();
  }

  private async attemptPairing(): Promise<void> {
    if (!this.callSid) return;

    const connections = connectionManager.getAllConnections();
    const callerConn = connections.find(
      (c) => c.role === "caller" && !c.pairedCallSid
    );
    const agentConn = connections.find(
      (c) => c.role === "agent" && !c.pairedCallSid
    );

    if (callerConn && agentConn) {
      connectionManager.pairConnections(callerConn.callSid, agentConn.callSid);

      this.bridge = new AudioBridge(
        callerConn.ws,
        agentConn.ws,
        callerConn.streamSid,
        agentConn.streamSid
      );

      console.log(
        `Audio bridge established: ${callerConn.callSid} <-> ${agentConn.callSid}`
      );
    }
  }

  private handleMedia(message: StreamMessage): void {
    if (!message.media) return;
  }

  private handleStop(): void {
    console.log("Stream stopped");
    this.cleanup();
  }

  private handleClose(): void {
    console.log("Stream connection closed");
    this.cleanup();
  }

  private handleError(error: Event): void {
    console.error("Stream error:", error);
    this.cleanup();
  }

  private cleanup(): void {
    if (this.callSid) {
      connectionManager.removeConnection(this.callSid);
    }

    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
    }

    this.callSid = null;
    this.streamSid = null;
  }
}

export { StreamHandler };
