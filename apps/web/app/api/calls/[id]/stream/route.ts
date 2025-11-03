import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SSEStream, createSSEResponse } from "@/lib/sse";
import type {
  CallStatusEvent,
  AMDUpdateEvent,
  AMDResultEvent,
  ErrorEvent,
} from "@/types/call.types";

const activeStreams = new Map<string, Set<SSEStream>>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  try {
    const call = await prisma.callLog.findUnique({
      where: { id },
      include: {
        amdEvents: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    if (!call) {
      return new Response("Call not found", { status: 404 });
    }

    const stream = new SSEStream();

    if (!activeStreams.has(id)) {
      activeStreams.set(id, new Set());
    }
    activeStreams.get(id)!.add(stream);

    stream.sendEvent<CallStatusEvent>({
      type: "call-status",
      data: {
        callId: id,
        status: call.callStatus,
        message: `Call ${call.callStatus.toLowerCase()}`,
      },
      timestamp: new Date().toISOString(),
    });

    if (call.amdResult) {
      stream.sendEvent<AMDResultEvent>({
        type: "amd-result",
        data: {
          callId: id,
          result: call.amdResult,
          confidence: call.amdConfidence || 0,
          detectionTimeMs: call.detectionTimeMs || 0,
          strategy: call.amdStrategy,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const isCallEnded = [
      "COMPLETED",
      "FAILED",
      "NO_ANSWER",
      "BUSY",
      "CANCELLED",
    ].includes(call.callStatus);

    if (isCallEnded) {
      setTimeout(() => {
        stream.close();
        const streams = activeStreams.get(id);
        if (streams) {
          streams.delete(stream);
          if (streams.size === 0) {
            activeStreams.delete(id);
          }
        }
      }, 3000);
    } else {
      let lastStatus = call.callStatus;
      let amdResultSent = false;

      const pollInterval = setInterval(async () => {
        if (stream.isClosed()) {
          clearInterval(pollInterval);
          return;
        }

        const updatedCall = await prisma.callLog.findUnique({
          where: { id },
          include: {
            amdEvents: {
              orderBy: { timestamp: "desc" },
              take: 1,
            },
          },
        });

        if (!updatedCall) {
          clearInterval(pollInterval);
          stream.close();
          const streams = activeStreams.get(id);
          if (streams) {
            streams.delete(stream);
            if (streams.size === 0) {
              activeStreams.delete(id);
            }
          }
          return;
        }

        if (updatedCall.callStatus !== lastStatus) {
          lastStatus = updatedCall.callStatus;
          stream.sendEvent<CallStatusEvent>({
            type: "call-status",
            data: {
              callId: id,
              status: updatedCall.callStatus,
              message: `Call ${updatedCall.callStatus.toLowerCase()}`,
            },
            timestamp: new Date().toISOString(),
          });
        }

        if (updatedCall.amdResult && !amdResultSent) {
          amdResultSent = true;
          stream.sendEvent<AMDResultEvent>({
            type: "amd-result",
            data: {
              callId: id,
              result: updatedCall.amdResult,
              confidence: updatedCall.amdConfidence || 0,
              detectionTimeMs: updatedCall.detectionTimeMs || 0,
              strategy: updatedCall.amdStrategy,
            },
            timestamp: new Date().toISOString(),
          });
        }

        if (
          ["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "CANCELLED"].includes(
            updatedCall.callStatus
          )
        ) {
          console.log(
            `Call ${id} ended with status ${updatedCall.callStatus}, stopping poll and closing stream`
          );
          clearInterval(pollInterval);
          stream.close();
          const streams = activeStreams.get(id);
          if (streams) {
            streams.delete(stream);
            if (streams.size === 0) {
              activeStreams.delete(id);
            }
          }
        }
      }, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        const streams = activeStreams.get(id);
        if (streams) {
          streams.delete(stream);
          if (streams.size === 0) {
            activeStreams.delete(id);
          }
        }
        stream.close();
      });
    }

    return createSSEResponse(stream.getStream());
  } catch (error) {
    console.error("Error creating SSE stream:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
