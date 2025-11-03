'use client';

import { useEffect } from 'react';
import { useCallHistory } from '@/hooks/use-call-history';
import { StatusBadge, AMDResultBadge } from '@/components/ui/badge';

export function CallHistory() {
  const { calls, isLoading, error, fetchCallHistory } = useCallHistory();

  useEffect(() => {
    fetchCallHistory();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-black rounded-lg shadow-sm border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Call History</h2>
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black rounded-lg shadow-sm border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Call History</h2>
        <div className="bg-red-950/20 border border-red-900 rounded-md p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchCallHistory}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline hover:cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-lg shadow-sm border border-neutral-800">
      <div className="px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Call History</h2>
          <button
            onClick={fetchCallHistory}
            className="text-sm text-neutral-400 hover:text-white hover:cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-neutral-500">No calls yet. Start dialing to see history.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-800">
            <thead className="bg-neutral-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Strategy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  AMD Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-black divide-y divide-neutral-800">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-neutral-900 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {call.targetNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-900 text-neutral-300 border border-neutral-800">
                      {call.amdStrategy.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={call.callStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {call.amdResult ? (
                      <AMDResultBadge result={call.amdResult} />
                    ) : (
                      <span className="text-neutral-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                    {call.amdConfidence !== null && call.amdConfidence !== undefined
                      ? `${Math.round(call.amdConfidence * 100)}%`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                    {call.callDuration !== null 
                      ? `${call.callDuration}s`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                    {new Date(call.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
