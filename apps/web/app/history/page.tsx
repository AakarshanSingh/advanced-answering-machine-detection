"use client";

import { CallHistory } from "@/components/call-history";
import { Navbar } from "@/components/navbar";

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Call History</h1>
          <p className="mt-2 text-sm text-neutral-400">
            View all past calls, AMD results, and performance metrics
          </p>
        </div>

        <CallHistory />
      </main>
    </div>
  );
}
