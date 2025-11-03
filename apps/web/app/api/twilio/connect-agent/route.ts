import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string;
  const agentNumber = process.env.AGENT_PHONE_NUMBER;
  
  console.log('=== CONNECT TO AGENT ===');
  console.log('CallSid:', callSid);
  console.log('Agent Number:', agentNumber);
  console.log('========================');
  
  if (!agentNumber) {
    console.error('AGENT_PHONE_NUMBER not configured');
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    return new NextResponse(twiml + '<Say voice="Polly.Joanna">Agent number not configured. Goodbye.</Say><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const callLog = await prisma.callLog.findUnique({
    where: { callSid },
  });

  if (callLog) {
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        callStatus: 'IN_PROGRESS',
      },
    });
  }

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  twiml += '<Say voice="Polly.Joanna">Human detected. Connecting you to an agent.</Say>';
  twiml += `<Dial timeout="30" action="${process.env.NGROK_URL}/api/twilio/dial-status">`;
  twiml += `<Number>${agentNumber}</Number>`;
  twiml += '</Dial>';
  twiml += '<Say voice="Polly.Joanna">The agent is not available. Goodbye.</Say>';
  twiml += '</Response>';
  
  console.log('Generated TwiML:', twiml);
  
  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
