import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export const dialRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "ratelimit:dial",
    })
  : null;

export const webhookRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, "1 m"), 
      analytics: true,
      prefix: "ratelimit:webhook",
    })
  : null;

export const sseRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "5 m"),
      analytics: true,
      prefix: "ratelimit:sse",
    })
  : null;

export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "ratelimit:auth",
    })
  : null;

export const generalRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: true,
      prefix: "ratelimit:general",
    })
  : null;

export function getClientIdentifier(
  request: Request,
  fallback = "anonymous"
): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip = forwardedFor?.split(",")[0].trim() || realIp || cfConnectingIp;

  return ip || fallback;
}

export function getTwilioIdentifier(body: Record<string, any>): string {
  return body.AccountSid || "unknown-twilio";
}

export async function checkRateLimit(
  rateLimit: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} | null> {
  if (!rateLimit) {
    console.warn(
      "[Rate Limit] Upstash not configured, skipping rate limit check"
    );
    return null;
  }

  try {
    const result = await rateLimit.limit(identifier);

    if (!result.success) {
      console.warn("[Rate Limit] Limit exceeded", {
        identifier,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString(),
      });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("[Rate Limit] Error checking rate limit:", error);

    return null;
  }
}

export function getRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

export function isRateLimitingEnabled(): boolean {
  return !!isUpstashConfigured;
}

if (isUpstashConfigured) {
  console.log("[Rate Limit] Upstash Redis configured - Rate limiting ENABLED");
} else {
  console.warn("[Rate Limit] Upstash not configured - Rate limiting DISABLED");
  console.warn(
    "[Rate Limit] Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable"
  );
}
