// app/api/clickpesa/debug-token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.CLICKPESA_CLIENT_ID;
    const apiKey = process.env.CLICKPESA_API_KEY;
    const baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';

    const results: any = {};

    // ─── Test 1: oauth/token ──────────────────────────────────────────────
    try {
      console.log('[Debug] Testing /oauth/token...');
      const res = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          apiKey: apiKey,
        }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      results.oauthToken = {
        status: res.status,
        statusText: res.statusText,
        response: json || text,
      };
    } catch (error: any) {
      results.oauthToken = { error: error.message };
    }

    // ─── Test 2: /auth/token ──────────────────────────────────────────────
    try {
      console.log('[Debug] Testing /auth/token...');
      const res = await fetch(`${baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          apiKey: apiKey,
        }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      results.authToken = {
        status: res.status,
        statusText: res.statusText,
        response: json || text,
      };
    } catch (error: any) {
      results.authToken = { error: error.message };
    }

    // ─── Test 3: /token ────────────────────────────────────────────────────
    try {
      console.log('[Debug] Testing /token...');
      const res = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          apiKey: apiKey,
        }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }

      results.token = {
        status: res.status,
        statusText: res.statusText,
        response: json || text,
      };
    } catch (error: any) {
      results.token = { error: error.message };
    }

    return NextResponse.json({
      success: true,
      baseUrl,
      credentials: {
        clientId: clientId ? '✅ Set' : '❌ Missing',
        apiKey: apiKey ? '✅ Set' : '❌ Missing',
      },
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}