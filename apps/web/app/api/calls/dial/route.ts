import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { strategyFactory } from "@/lib/amd/strategy";
import { TwilioNativeAMDStrategy } from "@/lib/amd/strategies/twilio-native";
import { GeminiFlashAMDStrategy } from "@/lib/amd/strategies/gemini-flash";
import type { DialCallRequest, DialCallResponse } from "@/types/call.types";
import type { AmdStrategy } from "@prisma/client";

strategyFactory.register(new TwilioNativeAMDStrategy());
strategyFactory.register(new GeminiFlashAMDStrategy());

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const dialSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  amdStrategy: z.enum([
    "TWILIO_NATIVE",
    "JAMBONZ",
    "HUGGINGFACE",
    "GEMINI_FLASH",
  ]),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<DialCallResponse>> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized", callId: "" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const body: DialCallRequest = await req.json();
    const validated = dialSchema.parse(body);

    const strategy = strategyFactory.get(validated.amdStrategy as AmdStrategy);

    const twilioConfig = strategy.configureTwilioCall({
      to: validated.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      callbackUrl: `${
        process.env.NGROK_URL || process.env.NEXT_PUBLIC_APP_URL
      }/api/twilio`,
    });

    const call = await twilioClient.calls.create({
      ...twilioConfig,
      asyncAmd: twilioConfig.asyncAmd ? "true" : undefined,
    });

    const statusCallbackUrl = new URL(twilioConfig.statusCallback);
    statusCallbackUrl.searchParams.set("callLogId", call.sid);

    const callLog = await prisma.callLog.create({
      data: {
        userId,
        targetNumber: validated.phoneNumber,
        fromNumber: process.env.TWILIO_PHONE_NUMBER!,
        callSid: call.sid,
        amdStrategy: validated.amdStrategy as AmdStrategy,
        callStatus: "INITIATED",
        notes: validated.notes,
      },
    });

    await prisma.amdEvent.create({
      data: {
        callLogId: callLog.id,
        eventType: "CALL_INITIATED",
        rawData: {
          callSid: call.sid,
          strategy: validated.amdStrategy,
        },
      },
    });

    return NextResponse.json({
      success: true,
      callId: callLog.id,
      callSid: call.sid,
      message: "Call initiated successfully",
    });
  } catch (error) {
    console.error("Error initiating call:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          callId: "",
          message: `Validation error: ${error.issues
            .map((e: { message: string }) => e.message)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("NGROK_URL")) {
      return NextResponse.json(
        {
          success: false,
          callId: "",
          message:
            "ngrok is required! Please start ngrok (ngrok http 3000) and add NGROK_URL to your .env file. See NGROK_SETUP.md for details.",
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("21205") ||
        error.message.includes("not a valid URL"))
    ) {
      return NextResponse.json(
        {
          success: false,
          callId: "",
          message:
            'Twilio requires a public URL. Please set up ngrok: 1) Run "ngrok http 3000" 2) Copy the HTTPS URL 3) Add to .env as NGROK_URL 4) Restart server. See NGROK_SETUP.md',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        callId: "",
        message:
          error instanceof Error ? error.message : "Failed to initiate call",
      },
      { status: 500 }
    );
  }
}
