import type { AmdResult } from "@prisma/client";
import type { AMDDetectionResult } from "@/types/call.types";
import type {
  IAMDStrategy,
  TwilioCallParams,
  TwilioCallConfig,
} from "../strategy";

export class TwilioNativeAMDStrategy implements IAMDStrategy {
  readonly name = "TWILIO_NATIVE" as const;
  readonly description = "Twilio built-in AMD with async callbacks";

  async initialize(): Promise<void> {
    console.log("Twilio Native AMD strategy initialized");
  }

  async processAudio(
    _audioBuffer: Buffer,
    _callSid: string
  ): Promise<AMDDetectionResult> {
    throw new Error(
      "Twilio Native AMD uses webhooks, not direct audio processing"
    );
  }

  configureTwilioCall(params: TwilioCallParams): TwilioCallConfig {
    const baseUrl = process.env.NGROK_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl || baseUrl.includes("localhost")) {
      throw new Error(
        "NGROK_URL is required for Twilio webhooks. Please start ngrok (ngrok http 3000) and set NGROK_URL in .env"
      );
    }

    return {
      to: params.to,
      from: params.from,
      url: `${baseUrl}/api/twilio/twiml`,
      statusCallback: `${baseUrl}/api/twilio/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],

      machineDetection: "DetectMessageEnd",
      machineDetectionTimeout: 3,
      machineDetectionSpeechThreshold: 1500,
      machineDetectionSpeechEndThreshold: 1000,
      machineDetectionSilenceTimeout: 2000,
      asyncAmd: true,
      asyncAmdStatusCallback: `${baseUrl}/api/twilio/amd`,
      asyncAmdStatusCallbackMethod: "POST",
    };
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }

  static parseWebhookResult(answeredBy: string): AmdResult {
    const mapping: Record<string, AmdResult> = {
      human: "HUMAN",
      unknown: "HUMAN",
      machine_start: "MACHINE_START",
      machine_end_beep: "MACHINE_END_BEEP",
      fax: "FAX",
    };

    return mapping[answeredBy] || "HUMAN";
  }
}
