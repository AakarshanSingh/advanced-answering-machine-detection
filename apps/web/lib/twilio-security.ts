/**
 * Twilio Webhook Security
 * 
 * Verifies that incoming webhook requests are genuinely from Twilio
 * by validating the X-Twilio-Signature header
 */

import twilio from 'twilio';

/**
 * Verify Twilio webhook signature
 * 
 * @param request - Incoming request object
 * @param body - Raw request body (must be unparsed)
 * @returns true if signature is valid, false otherwise
 */
export function verifyTwilioSignature(
  request: Request,
  body: Record<string, string | string[]>
): boolean {
  // Skip verification in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_SIGNATURE_VERIFICATION === 'true') {
    console.warn('[Security] Twilio signature verification DISABLED in development');
    return true;
  }

  const signature = request.headers.get('x-twilio-signature');
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!signature) {
    console.error('[Security] Missing X-Twilio-Signature header');
    return false;
  }

  if (!authToken) {
    console.error('[Security] TWILIO_AUTH_TOKEN not configured');
    return false;
  }

  // Get the full URL from the request
  const url = new URL(request.url);
  const fullUrl = url.toString();

  try {
    // Validate the request came from Twilio
    const isValid = twilio.validateRequest(
      authToken,
      signature,
      fullUrl,
      body
    );

    if (!isValid) {
      console.error('[Security] Invalid Twilio signature', {
        url: fullUrl,
        signature: signature.substring(0, 20) + '...',
      });
    }

    return isValid;
  } catch (error) {
    console.error('[Security] Error validating Twilio signature:', error);
    return false;
  }
}

/**
 * Extract and parse Twilio webhook body
 * 
 * @param request - Incoming request
 * @returns Parsed body as key-value pairs
 */
export async function parseTwilioWebhook(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    
    params.forEach((value, key) => {
      body[key] = value;
    });
    
    return body;
  }

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}

/**
 * Ensure webhook URL uses HTTPS in production
 * 
 * @param url - URL to check
 * @returns true if secure, false otherwise
 */
export function ensureHttps(url: string): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true; // Allow HTTP in development (ngrok uses HTTPS anyway)
  }

  return url.startsWith('https://');
}

/**
 * Validate Twilio Account SID format
 * 
 * @param accountSid - Account SID to validate
 * @returns true if valid format
 */
export function isValidAccountSid(accountSid: string): boolean {
  return /^AC[a-f0-9]{32}$/i.test(accountSid);
}

/**
 * Validate Twilio Call SID format
 * 
 * @param callSid - Call SID to validate
 * @returns true if valid format
 */
export function isValidCallSid(callSid: string): boolean {
  return /^CA[a-f0-9]{32}$/i.test(callSid);
}
