import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const callSid = formData.get("CallSid") as string;
  const dialCallStatus = formData.get("DialCallStatus") as string;
  const dialCallDuration = formData.get("DialCallDuration") as string | null;

  console.log(`[Dial Status] CallSid: ${callSid}, Status: ${dialCallStatus}, Duration: ${dialCallDuration}`);

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  if (callLog) {
    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });

    if (dialCallStatus === "completed") {
      console.log(`[Dial Status] Call completed successfully`);
      await prisma.callLog.update({
        where: { id: callLog.id },
        data: {
          callStatus: "COMPLETED",
          callDuration: dialCallDuration
            ? parseInt(dialCallDuration, 10)
            : null,
        },
      });

      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "CALL_HUNGUP",
          rawData: formDataObj,
        },
      });
    } else if (
      dialCallStatus === "no-answer" ||
      dialCallStatus === "busy" ||
      dialCallStatus === "failed"
    ) {
      console.log(`[Dial Status] Call failed with status: ${dialCallStatus}`);
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "ERROR_OCCURRED",
          rawData: formDataObj,
        },
      });
    }
  }

  // Return empty TwiML - the action URL in Dial already handles the response
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
