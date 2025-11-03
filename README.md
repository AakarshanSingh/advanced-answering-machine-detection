# Advanced Answering Machine Detection (AMD) System

A production-ready, multi-strategy answering machine detection system built with Next.js, Twilio, and real-time monitoring capabilities.

## 🎯 Key Features

- **Multi-Strategy AMD**: Support for 4 different detection strategies
  - ✅ Twilio Native AMD (Built-in, async callbacks)
  - 🚧 Jambonz SIP (SIP-based with custom recognizers)
  - 🚧 HuggingFace Model (ML-based wav2vec)
  - 🚧 Gemini 2.5 Flash (AI-powered audio analysis)

- **Real-Time Monitoring**: Server-Sent Events (SSE) for live call status updates
- **Comprehensive Logging**: Full event timeline with confidence scores and latency metrics
- **Type-Safe Architecture**: End-to-end TypeScript with Prisma ORM
- **Scalable Design**: Modular strategy pattern for easy extension
- **Authentication**: Secure user management with Better-Auth

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- Docker & Docker Compose
- Twilio account with Voice API enabled
- ngrok (for webhook testing in development)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd advanced-answering-machine-detection
cd apps/web
npm install
```

### 2. Environment Setup

Create `apps/web/.env`:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/amd_database?schema=public"

# Better Auth
BETTER_AUTH_SECRET="your-random-secret-key"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Twilio
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"
AGENT_PHONE_NUMBER="+1234567890"

# Webhook URL (use ngrok in development)
NGROK_URL="https://your-ngrok-url.ngrok.io"
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL & Adminer
docker compose up -d

# Run database migrations
cd apps/web
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 4. Set Up ngrok (REQUIRED for webhooks)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Add to apps/web/.env:
NGROK_URL="https://abc123.ngrok.io"
```

**Important:** Twilio cannot reach `localhost:3000`. You MUST use ngrok or deploy to a public server.

See [NGROK_SETUP.md](./NGROK_SETUP.md) for detailed instructions.

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000/dashboard

## ⚠️ Common Issues

### "NGROK_URL is required" Error
1. Start ngrok: `ngrok http 3000`
2. Copy the HTTPS URL
3. Add to `.env`: `NGROK_URL="https://your-url.ngrok.io"`
4. Restart dev server

### "Url is not a valid URL" Error
- Make sure you're using the **HTTPS** URL from ngrok, not HTTP
- Make sure there's no trailing slash
- Restart the dev server after updating `.env`
