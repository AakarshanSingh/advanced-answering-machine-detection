import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { TwilioNativeAMDStrategy } from "@/lib/amd/strategies/twilio-native";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const answeredBy = formData.get("AnsweredBy") as string;
    const machineDetectionDuration = formData.get(
      "MachineDetectionDuration"
    ) as string | null;

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
    });

    if (!callLog) {
      console.warn(`Call log not found for AMD callback: ${callSid}`);
      return NextResponse.json({ received: true });
    }

    const amdResult = TwilioNativeAMDStrategy.parseWebhookResult(answeredBy);
    const detectionTimeMs = machineDetectionDuration
      ? parseInt(machineDetectionDuration, 10) * 1000
      : null;

    const confidence = answeredBy === "unknown" ? 0.5 : 0.9;

    console.log(`[AMD Callback] ===== Twilio Native AMD =====`);
    console.log(`[AMD Callback] CallSid: ${callSid}`);
    console.log(`[AMD Callback] AnsweredBy: ${answeredBy}`);
    console.log(`[AMD Callback] Parsed Result: ${amdResult}`);
    console.log(`[AMD Callback] Confidence: ${confidence}`);
    console.log(`[AMD Callback] Detection Time: ${detectionTimeMs}ms`);
    console.log(`[AMD Callback] =====================================`);

    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        amdResult,
        amdConfidence: confidence,
        detectionTimeMs,
        callStatus:
          amdResult === "HUMAN" ? "HUMAN_DETECTED" : "MACHINE_DETECTED",
      },
    });

    console.log(`[AMD Callback] Database updated successfully for ${callSid}`);

    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });

    await prisma.amdEvent.create({
      data: {
        callLogId: callLog.id,
        eventType:
          amdResult === "HUMAN" ? "HUMAN_DETECTED" : "MACHINE_DETECTED",
        confidence,
        processingTime: detectionTimeMs,
        rawData: formDataObj,
      },
    });

    // Small delay to ensure database transaction is committed
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const redirectUrl = `${process.env.NGROK_URL}/api/twilio/twiml`;

      console.log(`[AMD Callback] Redirecting call ${callSid} to ${redirectUrl}`);

      await twilioClient.calls(callSid).update({
        url: redirectUrl,
        method: "POST",
      });

      console.log(`[AMD Callback] Successfully redirected call ${callSid}`);
    } catch (redirectError) {
      console.error(`[AMD Callback] Failed to redirect call ${callSid}:`, redirectError);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Twilio AMD callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
