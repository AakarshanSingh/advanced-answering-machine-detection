import type { CallStatus, AmdResult } from '@prisma/client';

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

function Badge({ className = '', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: CallStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<CallStatus, string> = {
    INITIATED: 'bg-blue-100 text-blue-800',
    RINGING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    HUMAN_DETECTED: 'bg-green-100 text-green-800',
    MACHINE_DETECTED: 'bg-orange-100 text-orange-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    FAILED: 'bg-red-100 text-red-800',
    NO_ANSWER: 'bg-gray-100 text-gray-800',
    BUSY: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  return (
    <Badge className={styles[status]}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

interface AMDResultBadgeProps {
  result: AmdResult;
}

export function AMDResultBadge({ result }: AMDResultBadgeProps) {
  const styles: Record<AmdResult, string> = {
    HUMAN: 'bg-green-100 text-green-800',
    VOICEMAIL: 'bg-orange-100 text-orange-800',
    MACHINE_START: 'bg-orange-100 text-orange-800',
    MACHINE_END_BEEP: 'bg-orange-100 text-orange-800',
    FAX: 'bg-yellow-100 text-yellow-800',
    UNDECIDED: 'bg-gray-100 text-gray-800',
    TIMEOUT: 'bg-red-100 text-red-800',
    ERROR: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={styles[result]}>
      {result.replace(/_/g, ' ')}
    </Badge>
  );
}
