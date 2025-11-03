import { useState, useEffect } from "react";
import type { CallMonitorState, CallEvent } from "@/types/call.types";
import type { CallStatus, AmdResult } from "@prisma/client";

interface UseCallMonitorReturn {
  state: CallMonitorState;
  isConnected: boolean;
}

export function useCallMonitor(
  callId: string,
  onCompleted: () => void
): UseCallMonitorReturn {
  const [state, setState] = useState<CallMonitorState>({
    callId,
    status: "INITIATED",
    events: [],
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCleaningUp = false;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/calls/${callId}/stream`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener("call-status", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: data.status,
          events: [
            ...prev.events,
            {
              type: "CALL_INITIATED",
              timestamp: new Date(),
              message: data.message,
            },
          ],
        }));

        if (
          ["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "CANCELLED"].includes(
            data.status
          )
        ) {
          isCleaningUp = true;
          if (eventSource) {
            eventSource.close();
            setIsConnected(false);
          }
          setTimeout(() => onCompleted(), 2000);
        }
      });

      eventSource.addEventListener("amd-update", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          confidence: data.confidence,
          events: [
            ...prev.events,
            {
              type: "AMD_PROCESSING",
              timestamp: new Date(),
              message: `Processing... (${Math.round(
                data.confidence * 100
              )}% confidence)`,
              confidence: data.confidence,
            },
          ],
        }));
      });

      eventSource.addEventListener("amd-result", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          amdResult: data.result,
          confidence: data.confidence,
          detectionTimeMs: data.detectionTimeMs,
          events: [
            ...prev.events,
            {
              type:
                data.result === "HUMAN" ? "HUMAN_DETECTED" : "MACHINE_DETECTED",
              timestamp: new Date(),
              message: `${data.result} detected (${Math.round(
                data.confidence * 100
              )}% confidence, ${data.detectionTimeMs}ms)`,
              confidence: data.confidence,
            },
          ],
        }));
      });

      eventSource.addEventListener("error", (event: Event) => {
        const messageEvent = event as MessageEvent;
        const data = messageEvent.data
          ? JSON.parse(messageEvent.data)
          : { error: "Connection error" };
        setState((prev) => ({
          ...prev,
          error: data.error,
          events: [
            ...prev.events,
            {
              type: "ERROR_OCCURRED",
              timestamp: new Date(),
              message: `Error: ${data.error}`,
            },
          ],
        }));
      });

      eventSource.onerror = (err) => {
        if (isCleaningUp) return;
        console.error("SSE connection error", err);
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          setIsConnected(false);
        }
      };
    };

    connectSSE();

    return () => {
      isCleaningUp = true;
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [callId, onCompleted]);

  return { state, isConnected };
}
