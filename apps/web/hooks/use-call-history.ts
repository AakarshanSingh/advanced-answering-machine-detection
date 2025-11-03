import { useState } from "react";
import type { CallHistoryItem } from "@/types/call.types";

interface UseCallHistoryReturn {
  calls: CallHistoryItem[];
  isLoading: boolean;
  error: string | null;
  fetchCallHistory: () => Promise<void>;
}

export function useCallHistory(): UseCallHistoryReturn {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCallHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/calls?limit=20");

      if (!response.ok) {
        throw new Error(`Failed to fetch call history: ${response.statusText}`);
      }

      const data = await response.json();
      setCalls(data.calls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching call history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return { calls, isLoading, error, fetchCallHistory };
}
