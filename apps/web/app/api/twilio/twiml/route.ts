import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const answeredBy = formData.get("AnsweredBy") as string | null;
  const callSid = formData.get("CallSid") as string;
  const callStatus = formData.get("CallStatus") as string | null;
  const digits = formData.get("Digits") as string | null;

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  const isHighConfidenceHuman = 
    callLog?.amdResult === "HUMAN" && 
    (callLog?.amdConfidence ?? 0) > 0.75;

  const isImmediateHuman = answeredBy === "human";

  if (isHighConfidenceHuman || isImmediateHuman) {
    const agentNumber = process.env.AGENT_PHONE_NUMBER;

    if (!agentNumber) {
      twiml +=
        '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else {
      twiml +=
        '<Say voice="Polly.Joanna">Human detected. Connecting you to our agent now. Please wait.</Say>';
      twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
      twiml += `<Number>${agentNumber}</Number>`;
      twiml += "</Dial>";
      twiml +=
        '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
      twiml += "<Hangup/>";
    }
  } else if (
    callLog?.amdResult &&
    ["MACHINE_START", "MACHINE_END_BEEP", "FAX"].includes(callLog.amdResult)
  ) {
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
    twiml +=
      '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
    twiml += '<Pause length="2"/>';
    twiml +=
      '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else if (callLog?.amdResult === "HUMAN" && (callLog?.amdConfidence ?? 0) <= 0.75) {
    twiml +=
      '<Say voice="Polly.Joanna">Low confidence human detection. Ending call. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else {
    twiml +=
      '<Say voice="Polly.Joanna">Please wait while we analyze your call.</Say>';
    twiml += '<Pause length="3"/>';
    twiml += `<Redirect>${process.env.NGROK_URL}/api/twilio/twiml</Redirect>`;
  }

  twiml += "</Response>";

  return new NextResponse(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
