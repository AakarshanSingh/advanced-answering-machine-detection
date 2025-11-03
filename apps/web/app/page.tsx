"use client";

import { Navbar } from "@/components/navbar";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-800 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-neutral-950 border border-neutral-800 px-5 py-6 shadow sm:px-6">
          <h1 className="text-3xl font-bold text-white">
            Welcome to Advanced Answering Machine Detection
          </h1>
          <p className="mt-4 text-lg text-neutral-400">
            Multi-strategy AMD system with real-time call monitoring
          </p>
          <div className="mt-8">
            <a 
              href="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-black bg-white hover:bg-neutral-200"
            >
              Get Started
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
