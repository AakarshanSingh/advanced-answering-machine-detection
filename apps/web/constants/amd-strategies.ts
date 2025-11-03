import type { StrategyOption } from "@/types/call.types";

export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: "TWILIO_NATIVE",
    label: "Twilio Native AMD",
    description: "Built-in Twilio detection with async callbacks",
    estimatedLatency: "~4s",
    enabled: true,
  },
  {
    value: "JAMBONZ",
    label: "Jambonz SIP",
    description: "SIP-based detection with custom recognizers",
    estimatedLatency: "~3s",
    enabled: false,
  },
  {
    value: "HUGGINGFACE",
    label: "HuggingFace Model",
    description: "ML-based detection using wav2vec",
    estimatedLatency: "~2s",
    enabled: false,
  },
  {
    value: "GEMINI_FLASH",
    label: "Gemini 2.5 Flash",
    description: "AI-powered real-time audio analysis",
    estimatedLatency: "~1.5s",
    enabled: false,
  },
];

export const TEST_NUMBERS = [
  { label: "Costco (Voicemail)", value: "+18007742678" },
  { label: "Nike (Voicemail)", value: "+18008066453" },
  { label: "PayPal (Voicemail)", value: "+18882211161" },
];
