import { NextRequest } from "next/server";

interface AgentStreamMessage {
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
  };
}

const agentStreams = new Map<string, WebSocket>();

export async function GET(req: NextRequest) {
  const upgradeHeader = req.headers.get("upgrade");

  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 426 });
  }

  return new Response(null, {
    status: 101,
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
    },
  });
}

export const dynamic = "force-dynamic";

class AgentStreamHandler {
  private ws: WebSocket;
  private callSid: string | null = null;
  private streamSid: string | null = null;
  private callerStream: WebSocket | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupListeners();
  }

  private setupListeners() {
    this.ws.addEventListener("message", this.handleMessage.bind(this));
    this.ws.addEventListener("close", this.handleClose.bind(this));
    this.ws.addEventListener("error", this.handleError.bind(this));
  }

  private async handleMessage(event: MessageEvent) {
    try {
      const message: AgentStreamMessage = JSON.parse(event.data.toString());

      switch (message.event) {
        case "connected":
          this.handleConnected();
          break;
        case "start":
          this.handleStart(message);
          break;
        case "media":
          this.handleMedia(message);
          break;
        case "stop":
          this.handleStop();
          break;
      }
    } catch (error) {
      console.error("Error handling agent stream message:", error);
    }
  }

  private handleConnected() {
    console.log("Agent stream connected");
  }

  private handleStart(message: AgentStreamMessage) {
    if (!message.start) return;

    this.callSid = message.start.callSid;
    this.streamSid = message.start.streamSid;

    agentStreams.set(message.start.callSid, this.ws);

    console.log(`Agent stream started for call ${message.start.callSid}`);
  }

  private handleMedia(message: AgentStreamMessage) {
    if (!message.media || !this.callerStream) return;

    if (message.media.track === "inbound") {
      this.forwardToCaller(message.media.payload);
    }
  }

  private forwardToCaller(payload: string) {
    if (!this.callerStream || this.callerStream.readyState !== WebSocket.OPEN) {
      return;
    }

    const mediaMessage = {
      event: "media",
      media: {
        payload,
      },
    };

    this.callerStream.send(JSON.stringify(mediaMessage));
  }

  private handleStop() {
    console.log("Agent stream stopped");
    this.cleanup();
  }

  private handleClose() {
    console.log("Agent stream connection closed");
    this.cleanup();
  }

  private handleError(error: Event) {
    console.error("Agent stream error:", error);
    this.cleanup();
  }

  private cleanup() {
    if (this.callSid) {
      agentStreams.delete(this.callSid);
    }

    if (this.callerStream) {
      this.callerStream.close();
      this.callerStream = null;
    }

    this.callSid = null;
    this.streamSid = null;
  }

  public setCallerStream(ws: WebSocket) {
    this.callerStream = ws;

    this.callerStream.addEventListener("message", (event: MessageEvent) => {
      try {
        const message: AgentStreamMessage = JSON.parse(event.data.toString());

        if (message.event === "media" && message.media?.track === "inbound") {
          this.forwardToAgent(message.media.payload);
        }
      } catch (error) {
        console.error("Error handling caller media:", error);
      }
    });
  }

  private forwardToAgent(payload: string) {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const mediaMessage = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload,
      },
    };

    this.ws.send(JSON.stringify(mediaMessage));
  }
}

export { AgentStreamHandler, agentStreams };
