import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CallStatus } from "@prisma/client";
import type { TwilioStatusCallback } from "@/types/call.types";

const statusMapping: Record<string, CallStatus> = {
  queued: "INITIATED",
  initiated: "INITIATED",
  ringing: "RINGING",
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
  failed: "FAILED",
  busy: "BUSY",
  "no-answer": "NO_ANSWER",
  canceled: "CANCELLED",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const twilioStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string | null;
    const errorCode = formData.get("ErrorCode") as string | null;
    const errorMessage = formData.get("ErrorMessage") as string | null;

    console.log("=== TWILIO STATUS WEBHOOK ===");
    console.log("CallSid:", callSid);
    console.log("Status:", twilioStatus);
    console.log("Duration:", callDuration);
    console.log("Error:", errorCode, errorMessage);
    console.log("Full webhook data:", Object.fromEntries(formData.entries()));
    console.log("============================");

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const callLog = await prisma.callLog.findUnique({
      where: { callSid },
    });

    if (!callLog) {
      console.warn(`Call log not found for SID: ${callSid}`);
      return NextResponse.json({ received: true });
    }

    const callStatus = statusMapping[twilioStatus] || "INITIATED";

    const updateData: {
      callStatus: CallStatus;
      callDuration?: number;
      errorCode?: string;
      errorMessage?: string;
      answeredAt?: Date;
      completedAt?: Date;
    } = {
      callStatus,
    };

    if (callDuration) {
      updateData.callDuration = parseInt(callDuration, 10);
    }

    if (errorCode) {
      updateData.errorCode = errorCode;
      updateData.errorMessage = errorMessage || undefined;
    }

    if (twilioStatus === "in-progress" && !callLog.answeredAt) {
      updateData.answeredAt = new Date();
    }

    if (
      ["completed", "failed", "busy", "no-answer", "canceled"].includes(
        twilioStatus
      )
    ) {
      updateData.completedAt = new Date();
    }

    await prisma.callLog.update({
      where: { id: callLog.id },
      data: updateData,
    });

    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });

    await prisma.amdEvent.create({
      data: {
        callLogId: callLog.id,
        eventType: getEventType(twilioStatus),
        rawData: formDataObj,
      },
    });

    console.log(`Call ${callSid} status updated: ${twilioStatus}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Twilio status callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getEventType(
  twilioStatus: string
):
  | "CALL_INITIATED"
  | "CALL_RINGING"
  | "CALL_ANSWERED"
  | "CALL_HUNGUP"
  | "ERROR_OCCURRED" {
  switch (twilioStatus) {
    case "queued":
    case "initiated":
      return "CALL_INITIATED";
    case "ringing":
      return "CALL_RINGING";
    case "in-progress":
      return "CALL_ANSWERED";
    case "completed":
    case "no-answer":
    case "busy":
    case "canceled":
      return "CALL_HUNGUP";
    default:
      return "ERROR_OCCURRED";
  }
}
