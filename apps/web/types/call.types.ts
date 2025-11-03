import type {
  CallStatus,
  AmdResult,
  AmdStrategy,
  AmdEventType,
} from "@prisma/client";

export interface CallHistoryItem {
  id: string;
  targetNumber: string;
  callSid: string | null;
  amdStrategy: AmdStrategy;
  callStatus: CallStatus;
  amdResult: AmdResult | null;
  amdConfidence: number | null;
  detectionTimeMs: number | null;
  callDuration: number | null;
  errorMessage: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  completedAt: Date | null;
}

export interface CallMonitorState {
  callId: string;
  status: CallStatus;
  amdResult?: AmdResult;
  confidence?: number;
  detectionTimeMs?: number;
  events: CallEvent[];
  error?: string;
}

export interface CallEvent {
  type: AmdEventType;
  timestamp: Date;
  message: string;
  confidence?: number;
}

export interface DialCallRequest {
  phoneNumber: string;
  amdStrategy: AmdStrategy;
  notes?: string;
}

export interface DialCallResponse {
  success: boolean;
  callId?: string;
  callSid?: string;
  message?: string;
  error?: string;
}

export interface CallMonitorProps {
  callId: string;
  onCompleted: () => void;
}

export interface StrategyOption {
  value: AmdStrategy;
  label: string;
  description: string;
  estimatedLatency: string;
  enabled: boolean;
}

export type SSEEventType =
  | "call-status"
  | "amd-update"
  | "amd-result"
  | "error"
  | "heartbeat";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

export interface CallStatusEvent {
  callId: string;
  status: CallStatus;
  message: string;
}

export interface AMDUpdateEvent {
  callId: string;
  confidence: number;
  processingTimeMs: number;
}

export interface AMDResultEvent {
  callId: string;
  result: AmdResult;
  confidence: number;
  detectionTimeMs: number;
  strategy: AmdStrategy;
}

export interface ErrorEvent {
  callId: string;
  error: string;
  errorCode?: string;
}

export interface TwilioStatusCallback {
  CallSid: string;
  CallStatus: string;
  From: string;
  To: string;
  Direction: string;
  Timestamp?: string;
  CallDuration?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface TwilioAMDCallback extends TwilioStatusCallback {
  AnsweredBy?:
    | "human"
    | "machine_start"
    | "machine_end_beep"
    | "fax"
    | "unknown";
  MachineDetectionDuration?: string;
}

export interface AMDDetectionResult {
  result: AmdResult;
  confidence: number;
  detectionTimeMs: number;
  rawResponse?: Record<string, unknown>;
}
