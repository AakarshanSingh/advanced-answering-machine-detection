"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function Navbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  if (isPending) {
    return (
      <nav className="border-b border-neutral-800 bg-black shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold text-white">AMD System</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-24 animate-pulse rounded bg-neutral-800"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-neutral-800 bg-black shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-white">AMD System</span>
            <div className="flex gap-4">
              <Link 
                href="/dashboard" 
                className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link 
                href="/history" 
                className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Call History
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm font-medium text-neutral-400">
                  Welcome, {session.user.name || session.user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-md hover:cursor-pointer bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-black transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
