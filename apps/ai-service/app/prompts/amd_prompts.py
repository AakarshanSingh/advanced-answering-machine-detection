GEMINI_AMD_CLASSIFICATION_PROMPT = """Analyze this telephone audio recording and classify who answered the call.

Your task: Determine if a HUMAN or ANSWERING MACHINE answered.

Classification criteria:

HUMAN indicators:
- Natural, conversational speech with pauses
- Interactive greetings like "Hello?", "Yes?", "Who is this?"
- Variable tone and emotional inflection
- Background sounds (people, environment)
- Spontaneous responses

MACHINE indicators:
- Pre-recorded greeting message
- Scripted, consistent delivery
- Professional voice quality without background noise
- Standard phrases: "You've reached...", "Leave a message", "not available"
- Beep tone after message
- Uniform pacing and volume

UNDECIDED (use only if audio is unclear):
- Too much noise to understand
- Audio under 1 second
- Complete silence
- Technical problems

Response format (JSON only):
{
  "classification": "HUMAN" or "MACHINE" or "UNDECIDED",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation in 20 words or less"
}

Requirements:
- Be decisive: prefer HUMAN or MACHINE over UNDECIDED
- Use confidence 0.8+ for clear cases
- Keep reasoning brief and specific
- Focus on audio characteristics only

Analyze now:"""""


GEMINI_AMD_FALLBACK_PROMPT = """Analyze this phone call audio and classify it as:
- HUMAN: Real person answering
- MACHINE: Voicemail or answering machine
- UNDECIDED: Cannot determine

Respond with JSON: {"classification": "HUMAN|MACHINE|UNDECIDED", "confidence": 0.0-1.0, "reasoning": "brief explanation"}"""
