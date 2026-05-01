import { getEnv } from '../../config/env.js';

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsProvider {
  name: string;
  send(msg: SmsMessage): Promise<void>;
}

// ─── Console provider (dev default) ─────────────────────────────────────────

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  // eslint-disable-next-line @typescript-eslint/require-await
  async send(msg: SmsMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[sms:console] to=${msg.to} body=${JSON.stringify(msg.body).slice(0, 200)}`);
  }
}

// ─── Twilio (minimal, no SDK — REST call) ───────────────────────────────────

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}
  async send(msg: SmsMessage): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const body = new URLSearchParams({ To: msg.to, From: this.from, Body: msg.body }).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Twilio SMS failed: ${res.status} ${text.slice(0, 200)}`);
    }
  }
}

// ─── Vonage ─────────────────────────────────────────────────────────────────

export class VonageSmsProvider implements SmsProvider {
  readonly name = 'vonage';
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly from: string,
  ) {}
  async send(msg: SmsMessage): Promise<void> {
    const res = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        from: this.from,
        to: msg.to,
        text: msg.body,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Vonage SMS failed: ${res.status}`);
    }
    const data = (await res.json()) as { messages?: Array<{ status?: string; 'error-text'?: string }> };
    const first = data.messages?.[0];
    if (!first || first.status !== '0') {
      throw new Error(`Vonage SMS rejected: ${first?.['error-text'] ?? 'unknown'}`);
    }
  }
}

// ─── Generic HTTP gateway (local SMS gateway / REST bridge) ─────────────────

export class HttpSmsProvider implements SmsProvider {
  readonly name = 'http';
  constructor(
    private readonly url: string,
    private readonly token: string | undefined,
    private readonly from: string,
  ) {}
  async send(msg: SmsMessage): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ from: this.from, to: msg.to, body: msg.body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP SMS gateway failed: ${res.status}`);
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const env = getEnv();
  switch (env.SMS_PROVIDER) {
    case 'twilio':
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
        cached = new ConsoleSmsProvider();
        break;
      }
      cached = new TwilioSmsProvider(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_AUTH_TOKEN,
        env.SMS_FROM,
      );
      break;
    case 'vonage':
      if (!env.VONAGE_API_KEY || !env.VONAGE_API_SECRET) {
        cached = new ConsoleSmsProvider();
        break;
      }
      cached = new VonageSmsProvider(env.VONAGE_API_KEY, env.VONAGE_API_SECRET, env.SMS_FROM);
      break;
    case 'http':
      if (!env.SMS_HTTP_URL) {
        cached = new ConsoleSmsProvider();
        break;
      }
      cached = new HttpSmsProvider(env.SMS_HTTP_URL, env.SMS_HTTP_TOKEN, env.SMS_FROM);
      break;
    case 'console':
    default:
      cached = new ConsoleSmsProvider();
  }
  return cached;
}

/** For tests: allow injecting a stub. */
export function setSmsProvider(p: SmsProvider | null): void {
  cached = p;
}
