"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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
      <nav className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900">AMD System</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-24 animate-pulse rounded bg-gray-200"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl font-bold text-gray-900">AMD System</span>
          </div>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm font-medium text-gray-700">
                  Welcome, {session.user.name || session.user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
