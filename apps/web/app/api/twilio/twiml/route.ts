import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const answeredBy = formData.get("AnsweredBy") as string | null;
  const callSid = formData.get("CallSid") as string;

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (callLog?.amdStrategy === "GEMINI_FLASH" && !callLog?.amdResult) {
    twiml += '<Say voice="Polly.Joanna">Please wait while we analyze your call.</Say>';
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

  const confidence = callLog?.amdConfidence ?? 0;
  const result = callLog?.amdResult;
  const strategy = callLog?.amdStrategy;

  const isHighConfidenceHuman = 
    result === "HUMAN" && 
    confidence > (strategy === "GEMINI_FLASH" ? 0.6 : 0.75);

  const isLowConfidenceHuman = 
    result === "HUMAN" && 
    confidence >= 0.5 && 
    confidence <= (strategy === "GEMINI_FLASH" ? 0.6 : 0.7);

  const isImmediateHuman = answeredBy === "human";
  const isUndecided = result === "UNDECIDED";

  console.log(`[TwiML] CallSid: ${callSid}, Strategy: ${strategy}, Result: ${result}, Confidence: ${confidence}`);
  console.log(`[TwiML] IsHighConfidenceHuman: ${isHighConfidenceHuman}, IsLowConfidenceHuman: ${isLowConfidenceHuman}, IsUndecided: ${isUndecided}`);

  if (isLowConfidenceHuman) {
    await prisma.amdEvent.create({
      data: {
        callLogId: callLog!.id,
        eventType: "CONFIDENCE_UPDATE",
        confidence: confidence,
        rawData: {
          message: "Low confidence detection - treating as human",
          threshold: strategy === "GEMINI_FLASH" ? 0.6 : 0.7,
        },
      },
    });
    console.log(`[TwiML] Low confidence human (${confidence}) - treating as human`);
  }

  if (isUndecided) {
    await prisma.amdEvent.create({
      data: {
        callLogId: callLog!.id,
        eventType: "CONFIDENCE_UPDATE",
        confidence: confidence,
        rawData: {
          message: "Undecided result - defaulting to human (safer)",
          result: "UNDECIDED",
        },
      },
    });
    console.log(`[TwiML] Undecided result (${confidence}) - defaulting to human for safety`);
  }

  if (isHighConfidenceHuman || isImmediateHuman || isLowConfidenceHuman || isUndecided) {
    const agentNumber = process.env.AGENT_PHONE_NUMBER;

    if (!agentNumber) {
      twiml +=
        '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say>';
      twiml += "<Hangup/>";
    } else {
      let message = "Human detected. Connecting you to our agent now. Please wait.";
      if (isLowConfidenceHuman) {
        message = "Undecided, but treating as human. Connecting you to our agent now.";
      } else if (isUndecided) {
        message = "Unable to classify. Connecting you to our agent for safety.";
      }
      
      twiml += `<Say voice="Polly.Joanna">${message}</Say>`;
      twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
      twiml += `<Number>${agentNumber}</Number>`;
      twiml += "</Dial>";
      twiml +=
        '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
      twiml += "<Hangup/>";
    }
  } else if (
    result &&
    ["MACHINE_START", "MACHINE_END_BEEP", "FAX"].includes(result)
  ) {
    await prisma.amdEvent.create({
      data: {
        callLogId: callLog!.id,
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
    console.log(`[TwiML] Twilio AMD detected machine (${answeredBy}) - leaving voicemail`);
    
    twiml +=
      '<Say voice="Polly.Joanna">Voicemail detected. Leaving message.</Say>';
    twiml += '<Pause length="2"/>';
    twiml +=
      '<Say voice="Polly.Joanna">Hello, this is a test call. Please call us back. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else if (result === "HUMAN" && confidence < 0.5) {
    await prisma.amdEvent.create({
      data: {
        callLogId: callLog!.id,
        eventType: "ERROR_OCCURRED",
        confidence: confidence,
        rawData: {
          message: `Very low confidence (${confidence}) - requires manual review`,
          requiresRetry: true,
        },
      },
    });
    
    console.log(`[TwiML] Very low confidence (${confidence}) - ending call for manual review`);
    
    twiml +=
      '<Say voice="Polly.Joanna">Unable to determine call type. Please try again later. Goodbye.</Say>';
    twiml += "<Hangup/>";
  } else {
    console.log(`[TwiML] No AMD result yet or timeout - redirecting for recheck`);
    
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
