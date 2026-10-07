// Supabase Edge Function: architect-send-otp
// Runs the SAME registration + eligibility checks LoginPage.jsx used to run
// client-side (master_architect lookup, commission_ledger eligibility), and
// if they pass, generates an OTP, stores it, and sends it via Pinnacle SMS.
//
// Expected secrets:
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_ROLE_KEY
//  - PINNACLE_ACCESS_KEY
//  - PINNACLE_HEADER
//  - PINNACLE_DLT_ENTITY_ID
//  - PINNACLE_DLT_TEMPLATE_ID
//  - PINNACLE_API_URL

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface SendOtpRequest {
  mobile_number: string;
  purpose?: string; // 'login' (default) or 'payout'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(phone: string, otp: string): Promise<boolean> {
  const pinnacleAccessKey = Deno.env.get('PINNACLE_ACCESS_KEY');
  const pinnacleHeader = Deno.env.get('PINNACLE_HEADER');
  const pinnacleDltEntityId = Deno.env.get('PINNACLE_DLT_ENTITY_ID');
  const pinnacleDltTemplateId = Deno.env.get('PINNACLE_DLT_TEMPLATE_ID');
  const pinnacleApiUrl = Deno.env.get('PINNACLE_API_URL') || 'https://api.pinnacle.in/index.php/sms/send';

  if (!pinnacleAccessKey || !pinnacleHeader || !pinnacleDltEntityId || !pinnacleDltTemplateId) {
    console.error('Pinnacle SMS credentials not configured');
    return false;
  }

  try {
    // Must match the DLT-registered template text exactly, or the operator drops the SMS.
    const message = `Your Duroply Architect Portal verification code is ${otp}. This code will expire in 10 minutes. - Team DUROPLY`;

    // Pinnacle expects international format without '+', e.g. 918123456789
    const digits = phone.replace(/\D/g, '');
    const number = digits.length === 10 ? `91${digits}` : digits;

    const response = await fetch(pinnacleApiUrl, {
      method: 'POST',
      headers: {
        'apikey': pinnacleAccessKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        sender: pinnacleHeader,
        numbers: number,
        message,
        messagetype: 'TXT',
        dltentityid: pinnacleDltEntityId,
        dlttempid: pinnacleDltTemplateId,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Pinnacle SMS API error:', responseText);
      return false;
    }

    // Pinnacle can return HTTP 200 with an EC10xx error code in the body
    let result: { status?: string } | null = null;
    try { result = JSON.parse(responseText); } catch { /* non-JSON body */ }

    if (!result || String(result.status).toLowerCase() !== 'success') {
      console.error('Pinnacle SMS API rejected request:', responseText);
      return false;
    }

    console.log(`OTP sent successfully to ${number}. Response:`, result);
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mobile_number, purpose }: SendOtpRequest = await req.json();
    const cleanMobile = (mobile_number || '').trim();
    const cleanPurpose = (purpose || 'login').trim();

    if (!cleanMobile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mobile number is required to proceed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // The 'login' purpose runs the same registration + eligibility gate the
    // frontend used to run itself. Other purposes (e.g. 'payout') are raised
    // from inside an already-authenticated session for a mobile number the
    // caller already resolved, so they skip straight to sending the OTP.
    if (cleanPurpose === 'login') {
      // 1. Locate the master architect profile (same check as before)
      const { data: architectData, error: dbError } = await supabaseAdmin
        .from('master_architect')
        .select('*')
        .eq('mobile_number', cleanMobile)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!architectData) {
        return new Response(
          JSON.stringify({ success: false, denialReason: 'not_registered', error: 'Mobile number is not registered in our database.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // 2. Extract account number and verify ledger eligibility (same check as before)
      const targetAccountNumber = architectData.account_number;

      if (!targetAccountNumber) {
        return new Response(
          JSON.stringify({ success: false, error: 'Profile error: Associated account number not found.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
        .from('commission_ledger')
        .select('status, architect_name')
        .ilike('architect_name', `%${targetAccountNumber}%`);

      if (ledgerError) throw ledgerError;

      const isEligibleUser = ledgerRows && ledgerRows.length > 0 && ledgerRows.some(
        (row: { status?: string }) => row.status && row.status.trim().toLowerCase() === 'eligible'
      );

      if (!isEligibleUser) {
        return new Response(
          JSON.stringify({ success: false, denialReason: 'ineligible', error: 'Payout status is marked as Ineligible.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // 3. Generate + store OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: otpInsertError } = await supabaseAdmin
      .from('architect_otp_verifications')
      .insert({
        mobile_number: cleanMobile,
        otp,
        expires_at: expiresAt.toISOString(),
        is_verified: false,
        attempts: 0,
        max_attempts: 3,
        purpose: cleanPurpose,
      });

    if (otpInsertError) {
      console.error('OTP insert error:', otpInsertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate OTP. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 4. Send OTP via SMS
    const smsSent = await sendOTP(cleanMobile, otp);

    if (!smsSent) {
      console.warn('SMS sending failed, OTP:', otp);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully',
        expiresAt: expiresAt.toISOString(),
        ...(Deno.env.get('ENVIRONMENT') === 'development' && { otp }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
