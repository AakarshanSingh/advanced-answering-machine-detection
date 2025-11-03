import type { AmdStrategy, AmdResult } from "@prisma/client";
import type { AMDDetectionResult } from "@/types/call.types";

export interface IAMDStrategy {
  readonly name: AmdStrategy;
  readonly description: string;

  initialize(): Promise<void>;

  processAudio(
    audioBuffer: Buffer,
    callSid: string
  ): Promise<AMDDetectionResult>;

  configureTwilioCall(params: TwilioCallParams): TwilioCallConfig;

  cleanup(): Promise<void>;
}

export interface TwilioCallParams {
  to: string;
  from: string;
  callbackUrl: string;
}

export interface TwilioCallConfig {
  to: string;
  from: string;
  url: string;
  statusCallback: string;
  statusCallbackEvent: string[];
  machineDetection?: "Enable" | "DetectMessageEnd";
  machineDetectionTimeout?: number;
  asyncAmd?: boolean;
  asyncAmdStatusCallback?: string;
  [key: string]: unknown;
}

export class AMDStrategyFactory {
  private strategies = new Map<AmdStrategy, IAMDStrategy>();

  register(strategy: IAMDStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(strategyName: AmdStrategy): IAMDStrategy {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }
    return strategy;
  }

  has(strategyName: AmdStrategy): boolean {
    return this.strategies.has(strategyName);
  }

  getAll(): IAMDStrategy[] {
    return Array.from(this.strategies.values());
  }
}

export const strategyFactory = new AMDStrategyFactory();
