/**
 * Zod Validation Schemas
 * 
 * Centralized input validation for all API routes
 * Prevents injection attacks and ensures data integrity
 */

import { z } from 'zod';

// Phone number validation (E.164 format)
const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +1234567890)')
  .min(8, 'Phone number too short')
  .max(16, 'Phone number too long');

// AMD Strategy enum
const amdStrategySchema = z.enum(['TWILIO_NATIVE', 'HUGGINGFACE', 'GEMINI_FLASH', 'JAMBONZ']);

// Call SID validation (Twilio format)
const callSidSchema = z
  .string()
  .regex(/^CA[a-f0-9]{32}$/i, 'Invalid Twilio Call SID format');

// Recording SID validation (Twilio format)
const recordingSidSchema = z
  .string()
  .regex(/^RE[a-f0-9]{32}$/i, 'Invalid Twilio Recording SID format');

// URL validation (HTTPS only for production)
const httpsUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => process.env.NODE_ENV === 'development' || url.startsWith('https://'),
    'URL must use HTTPS in production'
  );

// ============================================================================
// API Request Schemas
// ============================================================================

/**
 * POST /api/calls/dial
 * Initiate a new call
 */
export const dialRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
  strategy: amdStrategySchema,
  agentNumber: phoneNumberSchema.optional(),
});

export type DialRequest = z.infer<typeof dialRequestSchema>;

/**
 * POST /api/twilio/twiml
 * Generate TwiML instructions
 */
export const twimlRequestSchema = z.object({
  CallSid: callSidSchema,
  From: phoneNumberSchema.optional(),
  To: phoneNumberSchema.optional(),
  CallStatus: z.string().optional(),
});

export type TwimlRequest = z.infer<typeof twimlRequestSchema>;

/**
 * POST /api/twilio/amd
 * Twilio Native AMD callback
 */
export const amdCallbackSchema = z.object({
  CallSid: callSidSchema,
  AnsweredBy: z.enum(['human', 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax', 'unknown']),
  MachineDetectionDuration: z.string().optional(),
  Confidence: z.string().optional(),
});

export type AmdCallback = z.infer<typeof amdCallbackSchema>;

/**
 * POST /api/twilio/status
 * Call status callback
 */
export const statusCallbackSchema = z.object({
  CallSid: callSidSchema,
  CallStatus: z.enum(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  CallDuration: z.string().optional(),
  From: phoneNumberSchema.optional(),
  To: phoneNumberSchema.optional(),
});

export type StatusCallback = z.infer<typeof statusCallbackSchema>;

/**
 * POST /api/twilio/hf-callback
 * HuggingFace recording callback
 */
export const hfCallbackSchema = z.object({
  CallSid: callSidSchema,
  RecordingSid: recordingSidSchema.optional(),
  RecordingUrl: httpsUrlSchema.optional(),
  RecordingStatus: z.enum(['in-progress', 'completed', 'absent', 'failed']).optional(),
  RecordingDuration: z.string().optional(),
});

export type HfCallback = z.infer<typeof hfCallbackSchema>;

/**
 * POST /api/twilio/gemini-callback
 * Gemini recording callback
 */
export const geminiCallbackSchema = z.object({
  CallSid: callSidSchema,
  RecordingSid: recordingSidSchema.optional(),
  RecordingUrl: httpsUrlSchema.optional(),
  RecordingStatus: z.enum(['in-progress', 'completed', 'absent', 'failed']).optional(),
});

export type GeminiCallback = z.infer<typeof geminiCallbackSchema>;

/**
 * GET /api/calls/[id]/stream
 * SSE stream validation
 */
export const streamParamsSchema = z.object({
  id: callSidSchema,
});

export type StreamParams = z.infer<typeof streamParamsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and parse request body with Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Format Zod errors for API responses
 * 
 * @param error - Zod validation error
 * @returns User-friendly error message
 */
export function formatValidationError(error: z.ZodError): string {
  const firstError = error.issues[0];
  const field = firstError.path.join('.');
  const message = firstError.message;
  
  return field ? `${field}: ${message}` : message;
}

/**
 * Sanitize string inputs (prevent XSS)
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
