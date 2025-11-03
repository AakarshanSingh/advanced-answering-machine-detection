"use client";

import { useState } from "react";
import { DialerForm } from "@/components/dialer-form";
import { CallMonitor } from "@/components/call-monitor";
import { SetupChecklist } from "@/components/setup-checklist";
import { Navbar } from "@/components/navbar";

export default function DashboardPage() {
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const handleCallInitiated = (callId: string) => {
    setActiveCallId(callId);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <header className="bg-neutral-950 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-white">
            Advanced Answering Machine Detection
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Multi-strategy AMD system with real-time call monitoring
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SetupChecklist />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Initiate Call
              </h2>
              <DialerForm onCallInitiated={handleCallInitiated} />
            </div>
          </div>

          <div className="lg:col-span-2">
            {activeCallId ? (
              <CallMonitor callId={activeCallId} onCompleted={() => {}} />
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg shadow-sm p-6">
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-neutral-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    No Active Call
                  </h3>
                  <p className="text-neutral-500">
                    Initiate a call to see real-time monitoring
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
