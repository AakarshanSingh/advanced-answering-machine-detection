import { NextRequest } from "next/server";
import twilio from "twilio";

interface MediaStreamMessage {
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

interface ConnectionState {
  callSid: string;
  streamSid: string;
  agentCallSid?: string;
  agentStreamSid?: string;
}

const connections = new Map<string, ConnectionState>();

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

class MediaStreamHandler {
  private ws: WebSocket;
  private state: ConnectionState | null = null;
  private twilioClient: ReturnType<typeof twilio>;
  private agentConnection: WebSocket | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    this.setupListeners();
  }

  private setupListeners() {
    this.ws.addEventListener("message", this.handleMessage.bind(this));
    this.ws.addEventListener("close", this.handleClose.bind(this));
    this.ws.addEventListener("error", this.handleError.bind(this));
  }

  private async handleMessage(event: MessageEvent) {
    try {
      const message: MediaStreamMessage = JSON.parse(event.data.toString());

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
      console.error("Error handling media stream message:", error);
    }
  }

  private handleConnected() {
    console.log("Media stream connected");
  }

  private async handleStart(message: MediaStreamMessage) {
    if (!message.start) return;

    this.state = {
      callSid: message.start.callSid,
      streamSid: message.start.streamSid,
    };

    connections.set(message.start.callSid, this.state);

    console.log(`Media stream started for call ${message.start.callSid}`);

    await this.initiateAgentConnection();
  }

  private async initiateAgentConnection() {
    if (!this.state) return;

    const agentNumber = process.env.AGENT_PHONE_NUMBER;
    if (!agentNumber) {
      console.error("AGENT_PHONE_NUMBER not configured");
      return;
    }

    try {
      const call = await this.twilioClient.calls.create({
        to: agentNumber,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: `${process.env.NGROK_URL}/api/twilio/agent-connect`,
        statusCallback: `${process.env.NGROK_URL}/api/twilio/agent-status`,
        statusCallbackEvent: ["answered", "completed"],
      });

      this.state.agentCallSid = call.sid;
      console.log(`Agent call initiated: ${call.sid}`);
    } catch (error) {
      console.error("Failed to initiate agent call:", error);
    }
  }

  private handleMedia(message: MediaStreamMessage) {
    if (!message.media || !this.agentConnection) return;

    if (message.media.track === "inbound") {
      this.forwardToAgent(message.media.payload);
    }
  }

  private forwardToAgent(payload: string) {
    if (
      !this.agentConnection ||
      this.agentConnection.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const mediaMessage = {
      event: "media",
      streamSid: this.state?.agentStreamSid,
      media: {
        payload,
      },
    };

    this.agentConnection.send(JSON.stringify(mediaMessage));
  }

  private handleStop() {
    console.log("Media stream stopped");
    this.cleanup();
  }

  private handleClose() {
    console.log("WebSocket connection closed");
    this.cleanup();
  }

  private handleError(error: Event) {
    console.error("WebSocket error:", error);
    this.cleanup();
  }

  private cleanup() {
    if (this.state?.callSid) {
      connections.delete(this.state.callSid);
    }

    if (this.agentConnection) {
      this.agentConnection.close();
      this.agentConnection = null;
    }

    this.state = null;
  }

  public connectAgent(ws: WebSocket, streamSid: string) {
    this.agentConnection = ws;
    if (this.state) {
      this.state.agentStreamSid = streamSid;
    }

    this.agentConnection.addEventListener("message", (event: MessageEvent) => {
      try {
        const message: MediaStreamMessage = JSON.parse(event.data.toString());

        if (message.event === "media" && message.media?.track === "inbound") {
          this.forwardToCaller(message.media.payload);
        }
      } catch (error) {
        console.error("Error handling agent media:", error);
      }
    });
  }

  private forwardToCaller(payload: string) {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const mediaMessage = {
      event: "media",
      streamSid: this.state?.streamSid,
      media: {
        payload,
      },
    };

    this.ws.send(JSON.stringify(mediaMessage));
  }
}

export { MediaStreamHandler };
