import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyTwilioSignature,
  parseTwilioWebhook,
} from "@/lib/twilio-security";
import {
  webhookRateLimit,
  checkRateLimit,
  getTwilioIdentifier,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import {
  twimlRequestSchema,
  validateRequest,
  formatValidationError,
} from "@/lib/validation";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse webhook body
    const body = await parseTwilioWebhook(req);

    // 2. Verify Twilio signature
    if (!verifyTwilioSignature(req, body)) {
      console.error(
        "[TwiML] ❌ Invalid Twilio signature - possible security issue or webhook misconfiguration"
      );
      console.error("[TwiML] Request URL:", req.url);
      console.error(
        "[TwiML] Signature Header:",
        req.headers.get("x-twilio-signature")
      );

      // Return TwiML error instead of plain text
      const forbiddenTwiml =
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Security verification failed.</Say><Hangup/></Response>';
      return new NextResponse(forbiddenTwiml, {
        status: 403,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // 3. Rate limiting (by Twilio Account SID)
    const identifier = getTwilioIdentifier(body);
    const rateLimitResult = await checkRateLimit(webhookRateLimit, identifier);

    if (rateLimitResult && !rateLimitResult.success) {
      console.error("[TwiML] ⚠️ RATE LIMIT EXCEEDED!", {
        identifier,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: new Date(rateLimitResult.reset).toISOString(),
      });

      // Return TwiML error instead of plain text to avoid "application error"
      const rateLimitTwiml =
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Too many requests. Please try again in a moment.</Say><Hangup/></Response>';
      return new NextResponse(rateLimitTwiml, {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          "Content-Type": "text/xml",
        },
      });
    }

    // 4. Input validation
    const validationResult = validateRequest(twimlRequestSchema, body);

    if (!validationResult.success) {
      console.error(
        "[TwiML] ❌ Validation error:",
        formatValidationError(validationResult.error)
      );
      console.error("[TwiML] Request body:", body);

      // Return TwiML error instead of plain text
      const validationTwiml =
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Invalid request data.</Say><Hangup/></Response>';
      return new NextResponse(validationTwiml, {
        status: 400,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const { CallSid: callSid } = validationResult.data;
    const answeredBy = body.AnsweredBy as string | null;

    // Fetch call log with fresh data
    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
    });

    if (!callLog) {
      console.error(`[TwiML] Call log not found for ${callSid}`);
      const errorTwiml =
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Call log not found. Please try again.</Say><Hangup/></Response>';
      return new NextResponse(errorTwiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (callLog?.amdStrategy === "GEMINI_FLASH" && !callLog?.amdResult) {
      twiml +=
        '<Say voice="Polly.Joanna">Please wait while we analyze your call.</Say>';
      twiml += `<Record maxLength="5" recordingStatusCallback="${process.env.NGROK_URL}/api/twilio/gemini-amd" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="in-progress"/>`;
      twiml += '<Pause length="5"/>';
      twiml += `<Redirect>${process.env.NGROK_URL}/api/twilio/twiml</Redirect>`;
      twiml += "</Response>";

      return new NextResponse(twiml, {
        headers: {
          "Content-Type": "text/xml",
        },
      });
    }

    if (callLog?.amdStrategy === "HUGGINGFACE" && !callLog?.amdResult) {
      // For HuggingFace, we need to record audio and send to Python AI service
      // WebSocket streaming doesn't work in Next.js App Router, so we use recording approach like Gemini
      const aiServiceUrl =
        process.env.AI_SERVICE_URL || "http://localhost:8000";
      const callbackUrl = `${process.env.NGROK_URL}/api/twilio/hf-callback`;

      twiml +=
        '<Say voice="Polly.Joanna">Please wait while we analyze your call.</Say>';
      twiml += `<Record maxLength="5" recordingStatusCallback="${callbackUrl}?callSid=${callSid}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"/>`;
      twiml += '<Pause length="5"/>';
      twiml += `<Redirect>${process.env.NGROK_URL}/api/twilio/twiml</Redirect>`;
      twiml += "</Response>";

      return new NextResponse(twiml, {
        headers: {
          "Content-Type": "text/xml",
        },
      });
    }

    const confidence = callLog?.amdConfidence ?? 0;
    const result = callLog?.amdResult;
    const strategy = callLog?.amdStrategy;

    const isHumanDetected = result === "HUMAN" && confidence >= 0.5;
    const isImmediateHuman = answeredBy === "human";
    const isUndecided = result === "UNDECIDED";

    const isHighConfidenceHuman =
      result === "HUMAN" &&
      confidence > (strategy === "GEMINI_FLASH" ? 0.6 : 0.75);

    const isLowConfidenceHuman =
      result === "HUMAN" &&
      confidence >= 0.5 &&
      confidence <= (strategy === "GEMINI_FLASH" ? 0.6 : 0.75);

    console.log(`[TwiML] ===== AMD Decision Logic =====`);
    console.log(`[TwiML] CallSid: ${callSid}`);
    console.log(`[TwiML] Strategy: ${strategy}`);
    console.log(`[TwiML] Result: ${result}`);
    console.log(`[TwiML] Confidence: ${confidence}`);
    console.log(`[TwiML] AnsweredBy: ${answeredBy}`);
    console.log(`[TwiML] ----- Conditions -----`);
    console.log(`[TwiML] IsHumanDetected: ${isHumanDetected}`);
    console.log(`[TwiML] IsHighConfidenceHuman: ${isHighConfidenceHuman}`);
    console.log(`[TwiML] IsLowConfidenceHuman: ${isLowConfidenceHuman}`);
    console.log(`[TwiML] IsImmediateHuman: ${isImmediateHuman}`);
    console.log(`[TwiML] IsUndecided: ${isUndecided}`);
    console.log(`[TwiML] =============================`);

    // CRITICAL DECISION POINT
    console.log(
      `[TwiML] 🔍 DECISION: Should connect to agent? ${
        isHumanDetected || isImmediateHuman || isUndecided
      }`
    );
    console.log(
      `[TwiML] 📞 Agent Number: ${process.env.AGENT_PHONE_NUMBER || "NOT SET"}`
    );

    if (isLowConfidenceHuman && callLog) {
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "CONFIDENCE_UPDATE",
          confidence: confidence,
          rawData: {
            message: "Low confidence detection - treating as human",
            threshold: strategy === "GEMINI_FLASH" ? 0.6 : 0.7,
          },
        },
      });
      console.log(
        `[TwiML] Low confidence human (${confidence}) - treating as human`
      );
    }

    if (isUndecided && callLog) {
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "CONFIDENCE_UPDATE",
          confidence: confidence,
          rawData: {
            message: "Undecided result - defaulting to human (safer)",
            result: "UNDECIDED",
          },
        },
      });
      console.log(
        `[TwiML] Undecided result (${confidence}) - defaulting to human for safety`
      );
    }

    // Connect to agent if: human detected (any confidence >= 0.5), immediate human, or undecided
    if (isHumanDetected || isImmediateHuman || isUndecided) {
      console.log(`[TwiML] ✅ ENTERING AGENT CONNECTION BLOCK`);
      const agentNumber = process.env.AGENT_PHONE_NUMBER;

      if (!agentNumber) {
        console.log(`[TwiML] ❌ No agent number configured`);
        twiml +=
          '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say>';
        twiml += "<Hangup/>";
      } else {
        console.log(`[TwiML] ✅ Agent number found: ${agentNumber}`);
        let message =
          "Human detected. Connecting you to our agent now. Please wait.";
        if (isLowConfidenceHuman) {
          message =
            "Undecided, but treating as human. Connecting you to our agent now.";
        } else if (isUndecided) {
          message =
            "Unable to classify. Connecting you to our agent for safety.";
        }

        console.log(
          `[TwiML] 📞 Generating TwiML to connect to agent: ${agentNumber}`
        );
        console.log(`[TwiML] 💬 Message: ${message}`);

        twiml += `<Say voice="Polly.Joanna">${message}</Say>`;
        twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
        twiml += `<Number>${agentNumber}</Number>`;
        twiml += "</Dial>";
        twiml +=
          '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
        twiml += "<Hangup/>";

        console.log(
          `[TwiML] ✅ TwiML generated successfully for agent connection`
        );
      }
    } else if (
      result &&
      ["MACHINE_START", "MACHINE_END_BEEP", "FAX"].includes(result) &&
      callLog
    ) {
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "MACHINE_DETECTED",
          confidence: confidence,
          rawData: {
            result,
            message: "Machine detected - leaving voicemail",
          },
        },
      });

      console.log(`[TwiML] Machine detected (${result}) - leaving voicemail`);

      twiml +=
        '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
      twiml += '<Pause length="2"/>';
      twiml +=
        '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else if (
      answeredBy &&
      ["machine_start", "machine_end_beep", "fax"].includes(answeredBy)
    ) {
      console.log(
        `[TwiML] Twilio AMD detected machine (${answeredBy}) - leaving voicemail`
      );

      twiml +=
        '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
      twiml += '<Pause length="2"/>';
      twiml +=
        '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else if (result === "HUMAN" && confidence < 0.5 && callLog) {
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "ERROR_OCCURRED",
          confidence: confidence,
          rawData: {
            message: `Very low confidence (${confidence}) - requires manual review`,
            requiresRetry: true,
          },
        },
      });

      console.log(
        `[TwiML] Very low confidence (${confidence}) - ending call for manual review`
      );

      twiml +=
        '<Say voice="Polly.Joanna">Unable to determine call type. Please try again later. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else {
      console.log(
        `[TwiML] No AMD result yet or timeout - redirecting for recheck`
      );

      twiml +=
        '<Say voice="Polly.Joanna">Please wait while we analyze your call.</Say>';
      twiml += '<Pause length="3"/>';
      twiml += `<Redirect>${process.env.NGROK_URL}/api/twilio/twiml</Redirect>`;
    }

    twiml += "</Response>";

    console.log(`[TwiML] ========== FINAL TwiML ==========`);
    console.log(twiml);
    console.log(`[TwiML] ===================================`);

    return new NextResponse(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("[TwiML] Error generating TwiML:", error);

    // Return generic error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Please try again later.</Say><Hangup/></Response>`;

    return new NextResponse(errorTwiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
