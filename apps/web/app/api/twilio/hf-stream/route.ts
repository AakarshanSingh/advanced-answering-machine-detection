import { NextRequest } from "next/server";
import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { socket, response } = await upgradeToWebSocket(req);

  if (!socket || !response) {
    return new Response("WebSocket upgrade failed", { status: 400 });
  }

  return response;
}

async function upgradeToWebSocket(req: NextRequest) {
  const url = new URL(req.url);
  const callSid = url.searchParams.get("callSid");

  if (!callSid) {
    return { socket: null, response: null };
  }

  const wss = new WebSocketServer({ noServer: true });

  return new Promise<{ socket: WebSocket | null; response: Response | null }>(
    (resolve) => {
      wss.on("connection", async (twilioWs: WebSocket, request: IncomingMessage) => {
        console.log(`[HF Stream] WebSocket connected for call: ${callSid}`);

        let aiServiceWs: WebSocket | null = null;
        let isConnectedToAI = false;

        try {
          const wsUrl = AI_SERVICE_URL.replace("http", "ws");
          aiServiceWs = new WebSocket(`${wsUrl}/api/v1/amd/hf/stream`, {
            headers: {
              "X-Call-SID": callSid,
            },
          });

          aiServiceWs.on("open", () => {
            console.log(`[HF Stream] Connected to AI service for ${callSid}`);
            isConnectedToAI = true;
          });

          aiServiceWs.on("message", async (data: Buffer) => {
            try {
              const result = JSON.parse(data.toString());
              console.log(`[HF Stream] AI result for ${callSid}:`, result);

              await prisma.callLog.update({
                where: { callSid },
                data: {
                  amdResult: mapLabelToAmdResult(result.label),
                  amdConfidence: result.confidence,
                  detectionTimeMs: result.duration_ms,
                },
              });

              await prisma.amdEvent.create({
                data: {
                  callLog: { connect: { callSid } },
                  eventType: "AMD_RESULT",
                  confidence: result.confidence,
                  rawData: result,
                },
              });

              if (result.confidence > 0.7) {
                console.log(`[HF Stream] High confidence reached, closing stream`);
                twilioWs.close();
                aiServiceWs?.close();
              }
            } catch (error) {
              console.error(`[HF Stream] Error processing AI result:`, error);
            }
          });

          aiServiceWs.on("error", (error) => {
            console.error(`[HF Stream] AI WebSocket error:`, error);
          });

          aiServiceWs.on("close", () => {
            console.log(`[HF Stream] AI WebSocket closed for ${callSid}`);
            twilioWs.close();
          });
        } catch (error) {
          console.error(`[HF Stream] Failed to connect to AI service:`, error);
          twilioWs.close();
        }

        twilioWs.on("message", (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());

            if (message.event === "start") {
              console.log(`[HF Stream] Stream started for ${callSid}`);
            } else if (message.event === "media" && message.media) {
              if (isConnectedToAI && aiServiceWs?.readyState === WebSocket.OPEN) {
                const audioPayload = Buffer.from(message.media.payload, "base64");
                aiServiceWs.send(audioPayload);
              }
            } else if (message.event === "stop") {
              console.log(`[HF Stream] Stream stopped for ${callSid}`);
              aiServiceWs?.close();
            }
          } catch (error) {
            console.error(`[HF Stream] Error processing Twilio message:`, error);
          }
        });

        twilioWs.on("close", () => {
          console.log(`[HF Stream] Twilio WebSocket closed for ${callSid}`);
          aiServiceWs?.close();
        });

        twilioWs.on("error", (error) => {
          console.error(`[HF Stream] Twilio WebSocket error:`, error);
          aiServiceWs?.close();
        });
      });

      resolve({ socket: null, response: new Response("WebSocket upgraded", { status: 101 }) });
    }
  );
}

function mapLabelToAmdResult(label: string): "HUMAN" | "MACHINE_START" | "UNDECIDED" {
  const mapping: Record<string, "HUMAN" | "MACHINE_START" | "UNDECIDED"> = {
    human: "HUMAN",
    voicemail: "MACHINE_START",
    unknown: "UNDECIDED",
  };

  return mapping[label.toLowerCase()] || "UNDECIDED";
}
