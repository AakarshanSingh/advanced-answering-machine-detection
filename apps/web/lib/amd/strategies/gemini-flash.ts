import type { AmdResult } from "@prisma/client";
import type { AMDDetectionResult } from "@/types/call.types";
import type {
  IAMDStrategy,
  TwilioCallParams,
  TwilioCallConfig,
} from "../strategy";

interface GeminiAMDResponse {
  result: "HUMAN" | "MACHINE" | "UNKNOWN";
  confidence: number;
  reasoning?: string;
  processingTimeMs: number;
}

export class GeminiFlashAMDStrategy implements IAMDStrategy {
  readonly name = "GEMINI_FLASH" as const;
  readonly description = "Google Gemini 2.5 Flash real-time audio analysis";
  
  private aiServiceUrl: string;
  private maxRetries = 2;
  private timeout = 15000; // 15 seconds

  constructor() {
    const baseUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    this.aiServiceUrl = `${baseUrl}/api/v1/amd/gemini`;
  }

  async initialize(): Promise<void> {
    // Health check for AI service
    try {
      const healthUrl = this.aiServiceUrl.replace("/amd/gemini", "/health");
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`AI service health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Gemini Flash AMD initialization warning:", error);
      // Don't throw - allow graceful degradation
    }
  }

  async processAudio(
    audioBuffer: Buffer,
    callSid: string
  ): Promise<AMDDetectionResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const formData = new FormData();
        const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
          type: "audio/wav",
        });
        formData.append("audio", audioBlob, "audio.wav");
        formData.append("callSid", callSid);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.aiServiceUrl, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            "X-Call-SID": callSid,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `AI service returned ${response.status}: ${errorText}`
          );
        }

        const result: GeminiAMDResponse = await response.json();

        return {
          result: this.mapToAmdResult(result.result),
          confidence: result.confidence,
          detectionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
          continue;
        }
      }
    }

    // All retries failed - return fallback result
    return {
      result: "MACHINE_START",
      confidence: 0.3,
      detectionTimeMs: Date.now() - startTime,
    };
  }

  configureTwilioCall(params: TwilioCallParams): TwilioCallConfig {
    const baseUrl = process.env.NGROK_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl || baseUrl.includes("localhost")) {
      throw new Error(
        "NGROK_URL must be set for Gemini Flash AMD strategy (requires webhook tunneling)"
      );
    }

    return {
      to: params.to,
      from: params.from,
      url: `${baseUrl}/api/twilio/twiml`,
      statusCallback: `${baseUrl}/api/twilio/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      
      // Record first 5 seconds for AMD analysis
      record: true,
      recordingStatusCallback: `${baseUrl}/api/twilio/gemini-amd`,
      recordingStatusCallbackMethod: "POST",
      recordingChannels: "mono",
      trim: "do-not-trim",
      recordingStatusCallbackEvent: ["in-progress"],
    };
  }

  async cleanup(): Promise<void> {
    // No persistent resources to clean up
  }

  private mapToAmdResult(geminiResult: string): AmdResult {
    switch (geminiResult.toUpperCase()) {
      case "HUMAN":
        return "HUMAN";
      case "MACHINE":
      case "VOICEMAIL":
      case "ANSWERING_MACHINE":
        return "MACHINE_START";
      case "FAX":
        return "FAX";
      default:
        return "MACHINE_START";
    }
  }

  /**
   * Validates audio buffer before processing
   */
  private validateAudioBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // Minimum 1 second of audio at 8kHz (Twilio default)
    const minSizeBytes = 8000 * 2; // 16-bit samples
    return buffer.length >= minSizeBytes;
  }
}
