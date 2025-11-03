#!/bin/bash

# AMD System Setup Script
# This script automates the setup of the Advanced Answering Machine Detection system

set -e

echo "🚀 Advanced Answering Machine Detection - Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Step 1: Start Docker containers
echo "📦 Step 1: Starting PostgreSQL and Adminer..."
docker compose up -d
echo -e "${GREEN}✓ Docker containers started${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Installing npm dependencies..."
cd apps/web
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/amd_database?schema=public"

# Better Auth
BETTER_AUTH_SECRET="kdlgJakq20g04rv6VXGiYlgKHXAFfKWQ"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Twilio (REPLACE WITH YOUR CREDENTIALS)
TWILIO_ACCOUNT_SID="your_account_sid_here"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"
AGENT_PHONE_NUMBER="+1234567890"

# Webhook URL (use ngrok in development)
NGROK_URL=""

# Future Strategies
JAMBONZ_API_KEY=""
GOOGLE_GEMINI_API_KEY=""
PYTHON_SERVICE_URL="http://localhost:8000"
EOF
    echo -e "${YELLOW}⚠️  Please edit apps/web/.env and add your Twilio credentials${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Step 4: Run Prisma migrations
echo "🗄️  Step 4: Running database migrations..."
npx prisma generate
npx prisma migrate deploy || npx prisma migrate dev --name init
echo -e "${GREEN}✓ Database migrated${NC}"
echo ""

# Step 5: Instructions
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📋 Next Steps:"
echo "  1. Edit apps/web/.env with your Twilio credentials"
echo "  2. Start ngrok: ${YELLOW}ngrok http 3000${NC}"
echo "  3. Copy ngrok URL to .env as NGROK_URL"
echo "  4. Start dev server: ${YELLOW}cd apps/web && npm run dev${NC}"
echo "  5. Visit: ${YELLOW}http://localhost:3000${NC}"
echo ""
echo "🔧 Useful Commands:"
echo "  - View database: ${YELLOW}http://localhost:8080${NC} (Adminer)"
echo "  - Prisma Studio: ${YELLOW}npx prisma studio${NC}"
echo "  - View logs: ${YELLOW}docker compose logs -f${NC}"
echo ""
echo -e "${GREEN}Happy AMD testing! 🎉${NC}"
