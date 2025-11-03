#!/bin/bash

# AMD System Complete Setup & Start Script
# Sets up and optionally starts all services: Database, AI Service, Web App

set -e

# Get the project root directory (parent of scripts folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Advanced Answering Machine Detection - Complete Setup"
echo "========================================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running with sudo (we don't want that)
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Please do not run this script as root or with sudo${NC}"
    echo "   The script will ask for sudo password only when needed"
    exit 1
fi

# Determine if we need sudo for docker
DOCKER_CMD="docker"
DOCKER_COMPOSE_CMD="docker compose"

if ! docker ps >/dev/null 2>&1; then
    if sudo docker ps >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        DOCKER_COMPOSE_CMD="sudo docker compose"
        echo -e "${YELLOW}⚠ Docker requires sudo privileges on this system${NC}"
        echo ""
    else
        echo -e "${RED}❌ Docker is not accessible. Please ensure Docker is installed and running.${NC}"
        exit 1
    fi
fi

# Parse command line arguments
START_SERVICES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --start)
      START_SERVICES=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --start    Start all services after setup"
      echo "  --help     Show this help message"
      echo ""
      echo "This script will:"
      echo "  1. Check prerequisites (Docker, Node.js, Python)"
      echo "  2. Start PostgreSQL and Adminer containers"
      echo "  3. Setup Next.js web app (install deps, configure .env, run migrations)"
      echo "  4. Setup AI Service (configure .env, install Python deps)"
      echo "  5. Optionally start all services (with --start flag)"
      echo ""
      echo "Run from anywhere - script will auto-detect project root"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run '$0 --help' for usage"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}=== Step 1: Checking Prerequisites ===${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker found ($(docker --version | cut -d' ' -f3 | cut -d',' -f1))${NC}"

# Check Docker daemon
if ! $DOCKER_CMD ps >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker daemon is running${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+ first.${NC}"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js found ($NODE_VERSION)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found ($(npm --version))${NC}"

# Check if Python is installed
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Python 3 found ($PYTHON_VERSION)${NC}"
    HAS_PYTHON=true
else
    echo -e "${YELLOW}⚠ Python 3 not found - AI Service will use Docker only${NC}"
    HAS_PYTHON=false
fi

echo ""
echo -e "${GREEN}✓ All prerequisites satisfied${NC}"
echo ""

# =============================================================================
echo -e "${BLUE}=== Step 2: Starting Docker Services ===${NC}"
echo ""

cd "$PROJECT_ROOT"

echo "Starting PostgreSQL and Adminer..."
$DOCKER_COMPOSE_CMD up -d postgres adminer

echo "Waiting for PostgreSQL to be ready..."
for i in {1..10}; do
    if $DOCKER_CMD exec amd_postgres pg_isready -U user >/dev/null 2>&1; then
        break
    fi
    sleep 2
    echo "  Still waiting... ($i/10)"
done

if $DOCKER_CMD ps | grep -q amd_postgres; then
    echo -e "${GREEN}✓ PostgreSQL running on port 5432${NC}"
    echo -e "${GREEN}✓ Adminer running on http://localhost:8080${NC}"
else
    echo -e "${RED}❌ Failed to start database containers${NC}"
    echo "   Check logs: $DOCKER_CMD logs amd_postgres"
    exit 1
fi
echo ""

# =============================================================================
echo -e "${BLUE}=== Step 3: Setting Up Next.js Web App ===${NC}"
echo ""

cd "$PROJECT_ROOT/apps/web"

# Install npm dependencies
echo "Installing npm dependencies..."
if npm install; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Check/Create .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
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

# Jambonz (Future Strategy)
JAMBONZ_API_KEY=""

# AI Service
AI_SERVICE_URL="http://localhost:8000"

# Google Gemini
GOOGLE_GEMINI_API_KEY=""
EOF
    echo -e "${YELLOW}⚠️  Please edit apps/web/.env with your credentials:${NC}"
    echo "   - Twilio Account SID and Auth Token"
    echo "   - Your phone numbers"
    echo "   - Google Gemini API key"
    echo ""
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Run Prisma migrations
echo "Running database migrations..."
if npx prisma generate && (npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init); then
    echo -e "${GREEN}✓ Database schema migrated${NC}"
else
    echo -e "${RED}❌ Failed to run migrations${NC}"
    echo "   You may need to run: cd apps/web && npx prisma migrate dev"
fi

cd "$PROJECT_ROOT"
echo ""

# =============================================================================
echo -e "${BLUE}=== Step 4: Setting Up AI Service (Python) ===${NC}"
echo ""

cd "$PROJECT_ROOT/apps/ai-service"

# Check/Create .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating AI service .env file...${NC}"
    cat > .env << 'EOF'
# Google Gemini API
GEMINI_API_KEY=""

# Service configuration
HOST="0.0.0.0"
PORT=8000
LOG_LEVEL="info"
EOF
    echo -e "${YELLOW}⚠️  Please edit apps/ai-service/.env with your Gemini API key${NC}"
    echo "   Get one from: https://ai.google.dev"
    echo ""
else
    echo -e "${GREEN}✓ AI service .env file exists${NC}"
fi

# Setup Python environment
if [ "$HAS_PYTHON" = true ]; then
    echo "Setting up Python virtual environment..."
    
    if [ ! -d "venv" ]; then
        if python3 -m venv venv; then
            echo -e "${GREEN}✓ Virtual environment created${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to create virtual environment${NC}"
            HAS_PYTHON=false
        fi
    else
        echo -e "${GREEN}✓ Virtual environment exists${NC}"
    fi
    
    if [ "$HAS_PYTHON" = true ]; then
        source venv/bin/activate
        
        echo "Installing Python dependencies..."
        if pip install -q --upgrade pip && pip install -q -r requirements.txt; then
            echo -e "${GREEN}✓ Python dependencies installed${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to install Python dependencies${NC}"
        fi
        
        deactivate
    fi
else
    echo -e "${YELLOW}⚠ Skipping Python venv setup (Python not found)${NC}"
    echo "   AI Service will use Docker container"
fi

cd "$PROJECT_ROOT"
echo ""

# =============================================================================
echo -e "${BLUE}=== Setup Complete! ===${NC}"
echo ""

if [ "$START_SERVICES" = true ]; then
    echo -e "${BLUE}=== Starting All Services ===${NC}"
    echo ""
    
    # Start AI Service with Docker
    echo "Starting AI Service (Docker)..."
    $DOCKER_COMPOSE_CMD up -d ai-service
    
    echo "Waiting for AI Service to be ready..."
    for i in {1..10}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ AI Service running on http://localhost:8000${NC}"
            break
        fi
        sleep 2
        if [ $i -eq 10 ]; then
            echo -e "${YELLOW}⚠ AI Service may not be ready yet${NC}"
            echo "   Check status: $DOCKER_CMD logs amd_ai_service"
        fi
    done
    
    # Start Next.js dev server in background
    echo ""
    echo "Starting Next.js development server..."
    cd "$PROJECT_ROOT/apps/web"
    npm run dev > /tmp/amd-nextjs.log 2>&1 &
    WEB_PID=$!
    echo -e "${GREEN}✓ Next.js dev server starting (PID: $WEB_PID)${NC}"
    echo "   Logs: tail -f /tmp/amd-nextjs.log"
    cd "$PROJECT_ROOT"
    
    echo ""
    echo -e "${GREEN}🎉 All services are running!${NC}"
    echo ""
    echo "📋 Service URLs:"
    echo "  • Web App:      ${BLUE}http://localhost:3000${NC}"
    echo "  • AI Service:   ${BLUE}http://localhost:8000${NC} (API Docs: /docs)"
    echo "  • Database UI:  ${BLUE}http://localhost:8080${NC} (Adminer)"
    echo "  • Database:     postgresql://user:pass@localhost:5432/amd_database"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  • Stop all:     ${YELLOW}$DOCKER_COMPOSE_CMD down${NC}"
    echo "  • View logs:    ${YELLOW}$DOCKER_CMD logs -f amd_ai_service${NC}"
    echo "  • Restart AI:   ${YELLOW}$DOCKER_COMPOSE_CMD restart ai-service${NC}"
    echo "  • Kill web:     ${YELLOW}kill $WEB_PID${NC}"
    echo "  • Web logs:     ${YELLOW}tail -f /tmp/amd-nextjs.log${NC}"
    echo ""
else
    echo "✅ Setup completed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo ""
    echo "1. ${YELLOW}Configure credentials:${NC}"
    echo "   • Edit ${BLUE}apps/web/.env${NC} - Add Twilio credentials and phone numbers"
    echo "   • Edit ${BLUE}apps/ai-service/.env${NC} - Add Google Gemini API key"
    echo ""
    echo "2. ${YELLOW}Start ngrok for webhooks:${NC}"
    echo "   ${BLUE}ngrok http 3000${NC}"
    echo "   Then copy the https URL to apps/web/.env as NGROK_URL"
    echo ""
    echo "3. ${YELLOW}Start services:${NC}"
    echo "   Option A - Start all at once:"
    echo "     ${BLUE}./scripts/setup.sh --start${NC}"
    echo ""
    echo "   Option B - Start manually:"
    echo "     ${BLUE}$DOCKER_COMPOSE_CMD up -d ai-service${NC}    # AI Service"
    echo "     ${BLUE}cd apps/web && npm run dev${NC}              # Next.js"
    echo ""
    echo "4. ${YELLOW}Access your app:${NC}"
    echo "   • Web App:      ${BLUE}http://localhost:3000${NC}"
    echo "   • AI Service:   ${BLUE}http://localhost:8000/docs${NC}"
    echo "   • Database UI:  ${BLUE}http://localhost:8080${NC}"
    echo ""
    echo "📚 Documentation:"
    echo "   • Setup Guide:  ${BLUE}README.md${NC}"
    echo "   • ngrok Setup:  ${BLUE}NGROK_SETUP.md${NC}"
    echo "   • Architecture: ${BLUE}apps/ai-service/ARCHITECTURE.md${NC}"
    echo "   • Test Scenarios: ${BLUE}TEST_SCENARIOS.md${NC}"
    echo ""
fi

echo -e "${GREEN}Happy AMD testing! 🎉${NC}"
