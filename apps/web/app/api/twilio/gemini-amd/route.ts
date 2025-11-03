import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AmdResult } from "@prisma/client";

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;

    if (!callSid) {
      return NextResponse.json({ error: "CallSid required" }, { status: 400 });
    }

    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
    });

    if (!callLog) {
      console.error(`Call log not found for SID: ${callSid}`);
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (callLog.amdStrategy !== "GEMINI_FLASH") {
      return NextResponse.json(
        { error: "Not a Gemini Flash call" },
        { status: 400 }
      );
    }

    console.log(
      `[Gemini AMD] Recording ${recordingStatus} for call ${callSid}`
    );

    await prisma.amdEvent.create({
      data: {
        callLogId: callLog.id,
        eventType: "AUDIO_STREAM_STARTED",
        rawData: {
          recordingUrl,
          recordingStatus,
        },
      },
    });

    if (recordingStatus === "in-progress" && recordingUrl) {
      setTimeout(async () => {
        await analyzeRecording(callSid, recordingUrl, callLog.id);
      }, 3000);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Gemini AMD] Error:", error);
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
    console.log(`[Gemini AMD] Fetching recording for ${callSid}...`);

    const audioUrl = `${recordingUrl}.wav`;
    const response = await fetch(audioUrl, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64"),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch recording: ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    console.log(
      `[Gemini AMD] Sending ${audioBuffer.length} bytes to AI service...`
    );

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("audio", audioBlob, "audio.wav");

    const amdResponse = await fetch(`${AI_SERVICE_URL}/api/v1/amd/gemini`, {
      method: "POST",
      headers: {
        "X-Call-SID": callSid,
      },
      body: formData,
    });

    if (!amdResponse.ok) {
      const errorText = await amdResponse.text();
      throw new Error(
        `AI service error ${amdResponse.status}: ${errorText}`
      );
    }

    const result = await amdResponse.json();

    console.log(`[Gemini AMD] Result for ${callSid}:`, result);
    console.log(`[Gemini AMD] Classification: ${result.result}, Confidence: ${result.confidence}, Reasoning: ${result.reasoning}`);

    const amdResult = mapGeminiResult(result.result);

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        amdResult: amdResult as AmdResult,
        amdConfidence: result.confidence,
      },
    });

    console.log(`[Gemini AMD] Updated database - Result: ${amdResult}, Confidence: ${result.confidence}`);

    await prisma.amdEvent.create({
      data: {
        callLogId,
        eventType: "AMD_RESULT",
        confidence: result.confidence,
        rawData: {
          result: result.result,
          reasoning: result.reasoning,
          processingTimeMs: result.processingTimeMs,
        },
      },
    });

    console.log(`[Gemini AMD] Successfully analyzed ${callSid}: ${amdResult}`);
  } catch (error) {
    console.error(`[Gemini AMD] Analysis failed for ${callSid}:`, error);

    await prisma.amdEvent.create({
      data: {
        callLogId,
        eventType: "ERROR_OCCURRED",
        rawData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    });
  }
}

function mapGeminiResult(geminiResult: string): string {
  const normalized = geminiResult.toUpperCase();
  
  if (normalized === "HUMAN") return "HUMAN";
  if (normalized === "MACHINE" || normalized === "VOICEMAIL") return "MACHINE_START";
  if (normalized === "FAX") return "FAX";
  if (normalized === "UNDECIDED") return "UNDECIDED";
  
  console.warn(`[Gemini AMD] Unknown result '${geminiResult}', defaulting to UNDECIDED`);
  return "UNDECIDED";
}
