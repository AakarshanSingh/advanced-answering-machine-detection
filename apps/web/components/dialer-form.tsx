"use client";

import { useState } from "react";
import type { AmdStrategy } from "@prisma/client";
import type { DialCallRequest, DialCallResponse } from "@/types/call.types";
import { STRATEGY_OPTIONS, TEST_NUMBERS } from "@/constants/amd-strategies";

interface DialerFormProps {
  onCallInitiated: (callId: string) => void;
}

export function DialerForm({ onCallInitiated }: DialerFormProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amdStrategy, setAmdStrategy] = useState<AmdStrategy>("TWILIO_NATIVE");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const request: DialCallRequest = {
        phoneNumber,
        amdStrategy,
        notes: notes || undefined,
      };

      const response = await fetch("/api/calls/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data: DialCallResponse = await response.json();

      if (!data.success || !data.callId) {
        throw new Error(
          data.error || data.message || "Failed to initiate call"
        );
      }

      setPhoneNumber("");
      setNotes("");

      onCallInitiated(data.callId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate call");
      console.error("Error initiating call:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStrategy = STRATEGY_OPTIONS.find(
    (s) => s.value === amdStrategy
  )!;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="phoneNumber"
          className="block text-sm font-medium text-neutral-300 mb-1"
        >
          Phone Number
        </label>
        <input
          type="tel"
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1234567890"
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
          required
          pattern="^\+?[1-9]\d{1,14}$"
          title="Enter phone number in E.164 format (e.g., +1234567890)"
        />

        <div className="mt-2 space-y-1">
          <p className="text-xs text-neutral-500">Quick test numbers:</p>
          {TEST_NUMBERS.map((num) => (
            <button
              key={num.value}
              type="button"
              onClick={() => setPhoneNumber(num.value)}
              className="block text-xs text-neutral-400 hover:text-white hover:underline"
            >
              {num.label}: {num.value}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="amdStrategy"
          className="block text-sm font-medium text-neutral-300 mb-1"
        >
          AMD Strategy
        </label>
        <select
          id="amdStrategy"
          value={amdStrategy}
          onChange={(e) => setAmdStrategy(e.target.value as AmdStrategy)}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
          required
        >
          {STRATEGY_OPTIONS.map((strategy) => (
            <option
              key={strategy.value}
              value={strategy.value}
              disabled={!strategy.enabled}
            >
              {strategy.label} {!strategy.enabled && "(Coming Soon)"}
            </option>
          ))}
        </select>

        <div className="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded-md">
          <p className="text-sm font-medium text-white">
            {selectedStrategy.label}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {selectedStrategy.description}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            <span className="font-medium">Est. Latency:</span>{" "}
            {selectedStrategy.estimatedLatency}
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-neutral-300 mb-1"
        >
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Test notes or observations..."
          rows={2}
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none placeholder-neutral-600"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !phoneNumber}
        className="w-full px-4 py-3 bg-white text-black font-medium rounded-md hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Dialing...
          </span>
        ) : (
          "Dial Now"
        )}
      </button>
    </form>
  );
}
