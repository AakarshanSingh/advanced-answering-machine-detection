-- CreateEnum
CREATE TYPE "AmdStrategy" AS ENUM ('TWILIO_NATIVE', 'JAMBONZ', 'HUGGINGFACE', 'GEMINI_FLASH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'IN_PROGRESS', 'HUMAN_DETECTED', 'MACHINE_DETECTED', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmdResult" AS ENUM ('HUMAN', 'VOICEMAIL', 'MACHINE_START', 'MACHINE_END_BEEP', 'FAX', 'UNDECIDED', 'TIMEOUT', 'ERROR');

-- CreateEnum
CREATE TYPE "AmdEventType" AS ENUM ('CALL_INITIATED', 'CALL_RINGING', 'CALL_ANSWERED', 'AUDIO_STREAM_STARTED', 'AUDIO_CHUNK_RECEIVED', 'AMD_PROCESSING', 'AMD_RESULT', 'CONFIDENCE_UPDATE', 'HUMAN_DETECTED', 'MACHINE_DETECTED', 'CALL_CONNECTED', 'CALL_HUNGUP', 'ERROR_OCCURRED', 'RETRY_ATTEMPTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "amdStrategy" "AmdStrategy" NOT NULL,
    "callStatus" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "amdResult" "AmdResult",
    "amdConfidence" DOUBLE PRECISION,
    "detectionTimeMs" INTEGER,
    "callDuration" INTEGER,
    "ringDuration" INTEGER,
    "audioQualityScore" DOUBLE PRECISION,
    "rawAmdResponse" JSONB,
    "audioStreamUrl" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "retryReason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amd_events" (
    "id" TEXT NOT NULL,
    "callLogId" TEXT NOT NULL,
    "eventType" "AmdEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "rawData" JSONB,
    "audioChunk" TEXT,
    "transcription" TEXT,
    "modelResponse" JSONB,
    "processingTime" INTEGER,

    CONSTRAINT "amd_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testNumber" TEXT NOT NULL,
    "expectedResult" "AmdResult" NOT NULL,
    "amdStrategy" "AmdStrategy" NOT NULL,
    "actualResult" "AmdResult",
    "confidence" DOUBLE PRECISION,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "isFalsePositive" BOOLEAN NOT NULL DEFAULT false,
    "isFalseNegative" BOOLEAN NOT NULL DEFAULT false,
    "detectionTimeMs" INTEGER,
    "totalCallTimeMs" INTEGER,
    "notes" TEXT,
    "callSid" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_configs" (
    "id" TEXT NOT NULL,
    "strategy" "AmdStrategy" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "config" JSONB NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgLatency" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_callSid_key" ON "call_logs"("callSid");

-- CreateIndex
CREATE INDEX "call_logs_userId_idx" ON "call_logs"("userId");

-- CreateIndex
CREATE INDEX "call_logs_callStatus_idx" ON "call_logs"("callStatus");

-- CreateIndex
CREATE INDEX "call_logs_amdStrategy_idx" ON "call_logs"("amdStrategy");

-- CreateIndex
CREATE INDEX "call_logs_amdResult_idx" ON "call_logs"("amdResult");

-- CreateIndex
CREATE INDEX "call_logs_createdAt_idx" ON "call_logs"("createdAt");

-- CreateIndex
CREATE INDEX "call_logs_callSid_idx" ON "call_logs"("callSid");

-- CreateIndex
CREATE INDEX "amd_events_callLogId_idx" ON "amd_events"("callLogId");

-- CreateIndex
CREATE INDEX "amd_events_timestamp_idx" ON "amd_events"("timestamp");

-- CreateIndex
CREATE INDEX "amd_events_eventType_idx" ON "amd_events"("eventType");

-- CreateIndex
CREATE INDEX "test_results_testName_idx" ON "test_results"("testName");

-- CreateIndex
CREATE INDEX "test_results_amdStrategy_idx" ON "test_results"("amdStrategy");

-- CreateIndex
CREATE INDEX "test_results_isCorrect_idx" ON "test_results"("isCorrect");

-- CreateIndex
CREATE INDEX "test_results_createdAt_idx" ON "test_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_configs_strategy_key" ON "strategy_configs"("strategy");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amd_events" ADD CONSTRAINT "amd_events_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "call_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
