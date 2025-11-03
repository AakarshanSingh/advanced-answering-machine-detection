import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { strategyFactory } from "@/lib/amd/strategy";
import { TwilioNativeAMDStrategy } from "@/lib/amd/strategies/twilio-native";
import { GeminiFlashAMDStrategy } from "@/lib/amd/strategies/gemini-flash";
import { HuggingFaceAMDStrategy } from "@/lib/amd/strategies/huggingface";
import type { DialCallRequest, DialCallResponse } from "@/types/call.types";
import type { AmdStrategy } from "@prisma/client";

// Security imports
import { dialRequestSchema, validateRequest, formatValidationError } from "@/lib/validation";
import { dialRateLimit, checkRateLimit, getClientIdentifier, getRateLimitHeaders } from "@/lib/rate-limit";

strategyFactory.register(new TwilioNativeAMDStrategy());
strategyFactory.register(new GeminiFlashAMDStrategy());
strategyFactory.register(new HuggingFaceAMDStrategy());

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(
  req: NextRequest
): Promise<NextResponse<DialCallResponse>> {
  try {
    // 1. Rate limiting check
    const identifier = getClientIdentifier(req);
    const rateLimitResult = await checkRateLimit(dialRateLimit, identifier);

    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`, 
          callId: "" 
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      );
    }

    // 2. Authentication check
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

    // 3. Input validation with Zod
    const body = await req.json();
    
    const validationResult = validateRequest(dialRequestSchema, {
      phoneNumber: body.phoneNumber,
      strategy: body.amdStrategy, // Map frontend field to validation schema
      agentNumber: body.agentNumber,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Validation error: ${formatValidationError(validationResult.error)}`, 
          callId: "" 
        },
        { status: 400 }
      );
    }

    const validated = {
      phoneNumber: validationResult.data.phoneNumber,
      amdStrategy: validationResult.data.strategy, // Map back to frontend field
      notes: body.notes,
    };

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
