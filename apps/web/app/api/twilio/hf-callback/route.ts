import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTwilioSignature, parseTwilioWebhook } from "@/lib/twilio-security";
import { webhookRateLimit, checkRateLimit, getTwilioIdentifier, getRateLimitHeaders } from "@/lib/rate-limit";
import { hfCallbackSchema, validateRequest, formatValidationError } from "@/lib/validation";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    // 1. Parse webhook body
    const body = await parseTwilioWebhook(req);

    // 2. Verify Twilio signature
    if (!verifyTwilioSignature(req, body)) {
      console.error('[HF Callback] Invalid Twilio signature');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Rate limiting
    const identifier = getTwilioIdentifier(body);
    const rateLimitResult = await checkRateLimit(webhookRateLimit, identifier);

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' }, 
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      );
    }

    // 4. Input validation
    const validationResult = validateRequest(hfCallbackSchema, body);

    if (!validationResult.success) {
      console.error('[HF Callback] Validation error:', formatValidationError(validationResult.error));
      return NextResponse.json(
        { error: 'Invalid request data' }, 
        { status: 400 }
      );
    }

    const { CallSid: callSid, RecordingUrl: recordingUrl, RecordingStatus: recordingStatus } = validationResult.data;

    console.log(`[HF Callback] Received for call: ${callSid}, status: ${recordingStatus}`);

    if (recordingStatus !== "completed") {
      console.log(`[HF Callback] Recording not completed yet, ignoring`);
      return NextResponse.json({ received: true });
    }

    if (!recordingUrl) {
      console.error(`[HF Callback] No recording URL provided`);
      return NextResponse.json({ error: "No recording URL" }, { status: 400 });
    }

    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
    });

    if (!callLog) {
      console.error(`[HF Callback] Call log not found for ${callSid}`);
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Log the event
    await prisma.amdEvent.create({
      data: {
        callLogId: callLog.id,
        eventType: "AMD_RESULT",
        rawData: {
          recordingUrl,
          recordingStatus,
          message: "Recording received, processing...",
        },
      },
    });

    // Process the recording asynchronously
    analyzeRecording(callSid, recordingUrl, callLog.id).catch((error) => {
      console.error(`[HF Callback] Error analyzing recording:`, error);
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[HF Callback] Error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function analyzeRecording(
  callSid: string,
  recordingUrl: string,
  callLogId: string
) {
  try {
    console.log(`[HF Callback] Downloading recording from Twilio: ${recordingUrl}`);

    // Download the recording from Twilio
    const audioUrl = `${recordingUrl}.wav`;
    const audioResponse = await fetch(audioUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64"),
      },
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download recording: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    console.log(`[HF Callback] Downloaded ${audioBuffer.byteLength} bytes`);

    // Send to Python AI service
    console.log(`[HF Callback] Sending to AI service: ${AI_SERVICE_URL}/api/v1/amd/hf/predict`);

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("audio", blob, "audio.wav");

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/v1/amd/hf/predict`, {
      method: "POST",
      headers: {
        "X-Call-SID": callSid,
      },
      body: formData,
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI service error: ${aiResponse.status} - ${errorText}`);
    }

    const result = await aiResponse.json();
    console.log(`[HF Callback] AI result for ${callSid}:`, result);

    // Map HuggingFace labels to AMD results
    const amdResult = mapHFLabel(result.label);

    // Update database
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        amdResult,
        amdConfidence: result.confidence,
        detectionTimeMs: result.processingTimeMs,
      },
    });

    await prisma.amdEvent.create({
      data: {
        callLogId,
        eventType: "AMD_RESULT",
        confidence: result.confidence,
        rawData: result,
      },
    });

    console.log(`[HF Callback] Successfully processed ${callSid}: ${amdResult} (${result.confidence})`);
  } catch (error) {
    console.error(`[HF Callback] Error analyzing recording for ${callSid}:`, error);

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        amdResult: "UNDECIDED",
        amdConfidence: 0,
      },
    });

    await prisma.amdEvent.create({
      data: {
        callLogId,
        eventType: "ERROR_OCCURRED",
        rawData: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }
}

function mapHFLabel(label: string): "HUMAN" | "MACHINE_START" | "UNDECIDED" {
  const mapping: Record<string, "HUMAN" | "MACHINE_START" | "UNDECIDED"> = {
    human: "HUMAN",
    voicemail: "MACHINE_START",
    unknown: "UNDECIDED",
  };

  return mapping[label.toLowerCase()] || "UNDECIDED";
}
