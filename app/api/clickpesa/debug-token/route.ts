// app/api/clickpesa/debug-token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.CLICKPESA_CLIENT_ID;
    const apiKey = process.env.CLICKPESA_API_KEY;
    const baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';

    console.log('[Debug Token] Testing with:', {
      clientId: clientId ? '***' : 'MISSING',
      apiKey: apiKey ? '***' : 'MISSING',
      baseUrl,
    });

    if (!clientId || !apiKey) {
      return NextResponse.json({
        error: 'Missing credentials',
        clientId: !!clientId,
        apiKey: !!apiKey,
      }, { status: 400 });
    }

    const res = await fetch(`${baseUrl}/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': clientId,
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const status = res.status;
    const statusText = res.statusText;
    const responseText = await res.text();

    console.log('[Debug Token] Response:', {
      status,
      statusText,
      responseText,
    });

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = null;
    }

    return NextResponse.json({
      status,
      statusText,
      rawResponse: responseText,
      parsedResponse: json,
      headers: Object.fromEntries(res.headers.entries()),
    });

  } catch (error: any) {
    console.error('[Debug Token] Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}