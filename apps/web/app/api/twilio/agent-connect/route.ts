import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const callSid = formData.get("CallSid") as string;

  console.log("Agent call answered:", callSid);

  const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  const response =
    twiml +
    '<Say voice="Polly.Joanna">Connecting you to a caller.</Say>' +
    "<Connect>" +
    `<Stream url="wss://${process.env.NGROK_URL?.replace(
      "https://",
      ""
    )}/api/twilio/agent-stream">` +
    `<Parameter name="callSid" value="${callSid}" />` +
    '<Parameter name="role" value="agent" />' +
    "</Stream>" +
    "</Connect>" +
    '<Say voice="Polly.Joanna">The call has ended.</Say>' +
    "<Hangup/>" +
    "</Response>";

  return new NextResponse(response, {
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
