import type { AmdResult } from "@prisma/client";
import type { AMDDetectionResult } from "@/types/call.types";
import type {
  IAMDStrategy,
  TwilioCallParams,
  TwilioCallConfig,
} from "../strategy";

export class HuggingFaceAMDStrategy implements IAMDStrategy {
  readonly name = "HUGGINGFACE" as const;
  readonly description = "HuggingFace wav2vec ML model with WebSocket streaming";

  async initialize(): Promise<void> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    
    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/amd/hf/model-info`);
      if (!response.ok) {
        throw new Error("AI Service model not loaded");
      }
      const info = await response.json();
      console.log("[HuggingFace Strategy] Model info:", info);
    } catch (error) {
      console.warn("[HuggingFace Strategy] Could not verify model:", error);
    }
  }

  async processAudio(
    audioBuffer: Buffer,
    callSid: string
  ): Promise<AMDDetectionResult> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    
    const formData = new FormData();
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "audio/wav" });
    formData.append("audio", blob, "audio.wav");

    const response = await fetch(`${aiServiceUrl}/api/v1/amd/hf/predict`, {
      method: "POST",
      headers: {
        "X-Call-SID": callSid,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`AI Service error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      result: this.mapHFLabel(data.label),
      confidence: data.confidence,
      detectionTimeMs: data.processingTimeMs,
      rawResponse: data,
    };
  }

  configureTwilioCall(params: TwilioCallParams): TwilioCallConfig {
    const baseUrl = process.env.NGROK_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl || baseUrl.includes("localhost")) {
      throw new Error(
        "NGROK_URL is required for WebSocket streaming. Please start ngrok and set NGROK_URL in .env"
      );
    }

    return {
      to: params.to,
      from: params.from,
      url: `${baseUrl}/api/twilio/twiml`,
      statusCallback: `${baseUrl}/api/twilio/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    };
  }

  async cleanup(): Promise<void> {
    // No cleanup needed - model stays loaded
  }

  private mapHFLabel(label: string): AmdResult {
    const mapping: Record<string, AmdResult> = {
      human: "HUMAN",
      voicemail: "MACHINE_START",
      unknown: "UNDECIDED",
    };

    return mapping[label.toLowerCase()] || "UNDECIDED";
  }
}
