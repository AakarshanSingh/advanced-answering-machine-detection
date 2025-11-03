import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const callSid = formData.get("CallSid") as string;
  const dialCallStatus = formData.get("DialCallStatus") as string;
  const dialCallDuration = formData.get("DialCallDuration") as string | null;

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  if (callLog) {
    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = value.toString();
    });

    if (dialCallStatus === "completed") {
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
      await prisma.amdEvent.create({
        data: {
          callLogId: callLog.id,
          eventType: "ERROR_OCCURRED",
          rawData: formDataObj,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
