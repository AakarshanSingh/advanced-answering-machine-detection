# Setting Up ngrok for Twilio Webhooks

## Why Do I Need ngrok?

Twilio needs to send webhooks (HTTP requests) to your application to:
1. Send call status updates
2. Deliver AMD detection results
3. Get TwiML instructions

Since your app runs on `localhost:3000`, Twilio's servers can't reach it. **ngrok creates a public URL that tunnels to your local machine**.

## Quick Setup

### 1. Install ngrok

**Option A: Download from website**
```bash
# Visit https://ngrok.com/download
# Or use package managers:

# macOS
brew install ngrok

# Linux (snap)
sudo snap install ngrok

# Windows (chocolatey)
choco install ngrok
```

**Option B: Sign up (free)**
```bash
# Visit https://dashboard.ngrok.com/signup
# Get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 2. Start ngrok

```bash
ngrok http 3000
```

You'll see output like:
```
Session Status                online
Account                       your-email@example.com
Version                       3.3.0
Region                        United States (us)
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### 3. Copy the HTTPS URL

Copy the `https://abc123.ngrok.io` URL (use HTTPS, not HTTP!)

### 4. Update .env

```bash
cd apps/web
nano .env  # or use your favorite editor
```

Add this line:
```bash
NGROK_URL="https://abc123.ngrok.io"
```

**Important:** No trailing slash!

### 5. Restart Next.js

```bash
# Stop the dev server (Ctrl+C)
npm run dev
```

## Testing

1. Visit your app: http://localhost:3000/dashboard
2. Enter a test number: `+18007742678` (Costco voicemail)
3. Click "Dial Now"
4. Watch the real-time monitor!

## Troubleshooting

### Error: "NGROK_URL is required"
- Make sure you added `NGROK_URL` to `.env`
- Restart the dev server after updating `.env`

### Error: "Url is not a valid URL"
- Make sure the URL starts with `https://` (not `http://`)
- Make sure there's no trailing slash

### ngrok session expired
- Free ngrok URLs expire after 2 hours
- Just restart ngrok and update `.env` with the new URL

### Webhooks not arriving
- Check ngrok dashboard: http://127.0.0.1:4040
- You'll see all webhook requests from Twilio
- Check for errors in the ngrok logs

## ngrok Web Interface

While ngrok is running, visit: http://127.0.0.1:4040

This shows:
- All incoming requests
- Request/response details
- Timing information
- Replay requests for testing

## Production Alternative

For production, instead of ngrok:
- Deploy to Vercel/Railway/Render
- Use the production URL in Twilio webhook config
- Set environment variables on the platform

## Free Tier Limits

ngrok free tier includes:
- 1 online ngrok process
- 4 tunnels/ngrok process
- 40 connections/minute
- Random URL (changes each time you restart)

**Pro tip:** ngrok Pro gives you a permanent URL!

## Example Session

```bash
# Terminal 1: Start ngrok
$ ngrok http 3000
✓ Session Status: online
✓ Forwarding: https://abc123.ngrok.io -> http://localhost:3000

# Copy https://abc123.ngrok.io

# Terminal 2: Update .env and start dev server
$ cd apps/web
$ echo 'NGROK_URL="https://abc123.ngrok.io"' >> .env
$ npm run dev

# Terminal 3: Test (optional)
$ curl https://abc123.ngrok.io/api/twilio/twiml
<?xml version="1.0" encoding="UTF-8"?><Response>...
```

Now you're ready to make calls! 🎉
