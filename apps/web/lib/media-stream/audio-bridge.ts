interface MediaPayload {
  event: string;
  streamSid?: string;
  media?: {
    track?: string;
    chunk?: string;
    timestamp?: string;
    payload: string;
  };
}

class AudioBridge {
  private callerWs: WebSocket;
  private agentWs: WebSocket;
  private callerStreamSid: string;
  private agentStreamSid: string;
  private isActive: boolean;

  constructor(
    callerWs: WebSocket,
    agentWs: WebSocket,
    callerStreamSid: string,
    agentStreamSid: string
  ) {
    this.callerWs = callerWs;
    this.agentWs = agentWs;
    this.callerStreamSid = callerStreamSid;
    this.agentStreamSid = agentStreamSid;
    this.isActive = true;

    this.setupBridge();
  }

  private setupBridge(): void {
    this.callerWs.addEventListener(
      "message",
      this.handleCallerMessage.bind(this)
    );
    this.agentWs.addEventListener(
      "message",
      this.handleAgentMessage.bind(this)
    );

    this.callerWs.addEventListener("close", () =>
      this.handleDisconnect("caller")
    );
    this.agentWs.addEventListener("close", () =>
      this.handleDisconnect("agent")
    );

    this.callerWs.addEventListener("error", (error) =>
      this.handleError("caller", error)
    );
    this.agentWs.addEventListener("error", (error) =>
      this.handleError("agent", error)
    );
  }

  private handleCallerMessage(event: MessageEvent): void {
    if (!this.isActive) return;

    try {
      const message: MediaPayload = JSON.parse(event.data.toString());

      if (message.event === "media" && message.media?.track === "inbound") {
        this.forwardToAgent(message.media.payload);
      }
    } catch (error) {
      console.error("Error processing caller audio:", error);
    }
  }

  private handleAgentMessage(event: MessageEvent): void {
    if (!this.isActive) return;

    try {
      const message: MediaPayload = JSON.parse(event.data.toString());

      if (message.event === "media" && message.media?.track === "inbound") {
        this.forwardToCaller(message.media.payload);
      }
    } catch (error) {
      console.error("Error processing agent audio:", error);
    }
  }

  private forwardToAgent(payload: string): void {
    if (this.agentWs.readyState !== WebSocket.OPEN) return;

    const message: MediaPayload = {
      event: "media",
      streamSid: this.agentStreamSid,
      media: {
        payload,
      },
    };

    this.agentWs.send(JSON.stringify(message));
  }

  private forwardToCaller(payload: string): void {
    if (this.callerWs.readyState !== WebSocket.OPEN) return;

    const message: MediaPayload = {
      event: "media",
      streamSid: this.callerStreamSid,
      media: {
        payload,
      },
    };

    this.callerWs.send(JSON.stringify(message));
  }

  private handleDisconnect(role: "caller" | "agent"): void {
    console.log(`${role} disconnected from audio bridge`);
    this.destroy();
  }

  private handleError(role: "caller" | "agent", error: Event): void {
    console.error(`${role} audio bridge error:`, error);
    this.destroy();
  }

  public destroy(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.callerWs.readyState === WebSocket.OPEN) {
      this.callerWs.close();
    }

    if (this.agentWs.readyState === WebSocket.OPEN) {
      this.agentWs.close();
    }

    console.log("Audio bridge destroyed");
  }

  public isAlive(): boolean {
    return (
      this.isActive &&
      this.callerWs.readyState === WebSocket.OPEN &&
      this.agentWs.readyState === WebSocket.OPEN
    );
  }
}

export { AudioBridge };
