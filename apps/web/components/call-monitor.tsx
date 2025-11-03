"use client";

import { useCallMonitor } from "@/hooks/use-call-monitor";
import { StatusBadge, AMDResultBadge } from "@/components/ui/badge";
import { EventIcon } from "@/components/ui/event-icon";
import type { CallMonitorProps } from "@/types/call.types";

export function CallMonitor({ callId, onCompleted }: CallMonitorProps) {
  const { state, isConnected } = useCallMonitor(callId, onCompleted);

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Call Monitor</h2>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-neutral-400">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-neutral-900 border-b border-neutral-800">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-neutral-400">Call Status</p>
            <p className="mt-1 text-lg font-semibold">
              <StatusBadge status={state.status} />
            </p>
          </div>
          {state.amdResult && (
            <div>
              <p className="text-sm text-neutral-400">AMD Result</p>
              <p className="mt-1 text-lg font-semibold">
                <AMDResultBadge result={state.amdResult} />
              </p>
            </div>
          )}
        </div>

        {state.confidence !== undefined && (
          <div className="mt-4">
            <p className="text-sm text-neutral-400 mb-2">Confidence</p>
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.confidence * 100}%` }}
              />
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {Math.round((state.confidence || 0) * 100)}%
            </p>
          </div>
        )}

        {state.detectionTimeMs && (
          <div className="mt-2">
            <p className="text-xs text-neutral-400">
              Detection Time:{" "}
              <span className="font-medium text-white">
                {state.detectionTimeMs}ms
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">
          Event Timeline
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {state.events.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              Waiting for events...
            </p>
          ) : (
            state.events.map((event, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <EventIcon type={event.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{event.message}</p>
                  <p className="text-xs text-neutral-500">
                    {event.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {state.error && (
        <div className="px-6 py-4 bg-red-950/20 border-t border-red-900">
          <p className="text-sm text-red-400">
            <span className="font-medium">Error:</span> {state.error}
          </p>
        </div>
      )}
    </div>
  );
}
