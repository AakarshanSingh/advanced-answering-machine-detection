import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const answeredBy = formData.get("AnsweredBy") as string | null;
  const callSid = formData.get("CallSid") as string;
  const callStatus = formData.get("CallStatus") as string | null;
  const amdStatusCallbackEvent = formData.get("MachineDetection") as
    | string
    | null;

  console.log("=== TWIML REQUEST ===");
  console.log("CallSid:", callSid);
  console.log("CallStatus:", callStatus);
  console.log("AnsweredBy:", answeredBy);
  console.log("MachineDetection Event:", amdStatusCallbackEvent);
  console.log("All form data:", Object.fromEntries(formData.entries()));
  console.log("=====================");

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (callLog?.amdResult === "HUMAN") {
    const agentNumber = process.env.AGENT_PHONE_NUMBER;

    if (agentNumber) {
      console.log(`Connecting call ${callSid} to agent: ${agentNumber}`);
      twiml +=
        '<Say voice="Polly.Joanna">Human detected. Connecting you to our agent now.</Say>';
      twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
      twiml += `<Number>${agentNumber}</Number>`;
      twiml += "</Dial>";
      twiml +=
        '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else {
      console.error("AGENT_PHONE_NUMBER not configured");
      twiml +=
        '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say>';
      twiml += "<Hangup/>";
    }
  } else if (
    callLog?.amdResult &&
    ["MACHINE_START", "MACHINE_END_BEEP", "FAX"].includes(callLog.amdResult)
  ) {
    console.log(`Machine detected for call ${callSid}: ${callLog.amdResult}`);
    twiml +=
      '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
    twiml += '<Pause length="2"/>';
    twiml +=
      '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else if (answeredBy === "human") {
    const agentNumber = process.env.AGENT_PHONE_NUMBER;

    if (agentNumber) {
      console.log(
        `Immediate human detection for ${callSid}, connecting to agent: ${agentNumber}`
      );
      twiml +=
        '<Say voice="Polly.Joanna">Human detected. Connecting you to our agent now.</Say>';
      twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
      twiml += `<Number>${agentNumber}</Number>`;
      twiml += "</Dial>";
      twiml +=
        '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else {
      console.error("AGENT_PHONE_NUMBER not configured");
      twiml +=
        '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say>';
      twiml += "<Hangup/>";
    }
  } else if (
    answeredBy &&
    ["machine_start", "machine_end_beep", "fax"].includes(answeredBy)
  ) {
    console.log(`mmediate machine detection for ${callSid}: ${answeredBy}`);
    twiml +=
      '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
    twiml += '<Pause length="2"/>';
    twiml +=
      '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else {
    console.log(`Waiting for AMD result for call ${callSid}...`);
    twiml +=
      '<Say voice="Polly.Joanna">Please wait while we connect your call.</Say>';
    twiml += '<Pause length="3"/>';
    twiml += `<Redirect>${process.env.NGROK_URL}/api/twilio/twiml</Redirect>`;
  }

  twiml += "</Response>";

  console.log("Generated TwiML:", twiml);

  return new NextResponse(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
