import type { StrategyOption } from "@/types/call.types";

export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: "TWILIO_NATIVE",
    label: "Twilio Native AMD",
    enabled: true,
  },
  {
    value: "JAMBONZ",
    label: "Jambonz SIP",
    enabled: false,
  },
  {
    value: "HUGGINGFACE",
    label: "HuggingFace Model",
    enabled: true,
  },
  {
    value: "GEMINI_FLASH",
    label: "Gemini 2.5 Flash",
    enabled: true,
  },
];

export const TEST_NUMBERS = [
  { label: "Costco (Voicemail)", value: "+18007742678" },
  { label: "Nike (Voicemail)", value: "+18008066453" },
  { label: "PayPal (Voicemail)", value: "+18882211161" },
];
