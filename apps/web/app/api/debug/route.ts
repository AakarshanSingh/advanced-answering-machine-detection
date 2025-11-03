import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const config = {
    ngrokUrl: process.env.NGROK_URL || "NOT SET",
    nextPublicUrl: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID
      ? "SET (hidden)"
      : "NOT SET",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ? "SET (hidden)" : "NOT SET",
    twilioPhone: process.env.TWILIO_PHONE_NUMBER || "NOT SET",
    databaseUrl: process.env.DATABASE_URL ? "SET (hidden)" : "NOT SET",
    webhookUrls: {
      twiml: `${process.env.NGROK_URL || "MISSING"}/api/twilio/twiml`,
      status: `${process.env.NGROK_URL || "MISSING"}/api/twilio/status`,
      amd: `${process.env.NGROK_URL || "MISSING"}/api/twilio/amd`,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(config, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
