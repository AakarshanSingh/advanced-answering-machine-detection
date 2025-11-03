import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const calls = await prisma.callLog.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        targetNumber: true,
        callSid: true,
        amdStrategy: true,
        callStatus: true,
        amdResult: true,
        amdConfidence: true,
        detectionTimeMs: true,
        callDuration: true,
        errorMessage: true,
        createdAt: true,
        answeredAt: true,
        completedAt: true,
      },
    });

    const formattedCalls = calls.map((call) => ({
      id: call.id,
      targetNumber: call.targetNumber,
      callSid: call.callSid,
      amdStrategy: call.amdStrategy,
      callStatus: call.callStatus,
      amdResult: call.amdResult,
      amdConfidence: call.amdConfidence,
      detectionTimeMs: call.detectionTimeMs,
      callDuration: call.callDuration,
      errorMessage: call.errorMessage,
      createdAt: call.createdAt,
      answeredAt: call.answeredAt,
      completedAt: call.completedAt,
    }));

    return NextResponse.json({
      calls: formattedCalls,
      total: calls.length,
    });
  } catch (error) {
    console.error("Error fetching call history:", error);
    return NextResponse.json(
      { error: "Failed to fetch call history" },
      { status: 500 }
    );
  }
}
