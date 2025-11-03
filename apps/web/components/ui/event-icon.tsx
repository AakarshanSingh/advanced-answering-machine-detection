import type { AmdEventType } from '@prisma/client';

interface EventIconProps {
  type: AmdEventType;
}

export function EventIcon({ type }: EventIconProps) {
  const colors: Record<string, string> = {
    CALL_INITIATED: 'text-blue-500',
    CALL_RINGING: 'text-yellow-500',
    CALL_ANSWERED: 'text-purple-500',
    AMD_PROCESSING: 'text-blue-500',
    HUMAN_DETECTED: 'text-green-500',
    MACHINE_DETECTED: 'text-orange-500',
    ERROR_OCCURRED: 'text-red-500',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[type] || 'bg-gray-400'}`} />
  );
}
