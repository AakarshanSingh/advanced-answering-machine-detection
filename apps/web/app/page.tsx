"use client";

import { Navbar } from "@/components/navbar";
import { useSession } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white px-5 py-6 shadow sm:px-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Advanced Answering Machine Detection
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            You are logged in as <span className="font-semibold">{session?.user?.email}</span>
          </p>
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">Getting Started</h2>
            <p className="mt-2 text-gray-600">
              This is your protected home page. You can now build your AMD system features here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
