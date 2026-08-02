/**
 * Payment helper unit tests
 * Tests gateway dispatcher logic, env-based routing, and parameter building.
 * External HTTP calls are mocked via vi.stubGlobal('fetch', ...).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock ENV before importing payment module ────────────────────────────────
vi.mock('./_core/env', () => ({
  ENV: {
    paymentGateway: 'myfatoorah',
    myfatoorahApiKey: 'test-mf-key',
    myfatoorahIsTest: true,
    tapSecretKey: 'test-tap-key',
  },
}));

// Mock DB so getActiveGateway / getMfSettings fall back to ENV (no real DB in tests)
vi.mock('./db', () => ({
  getDb: async () => null,
}));

import { getActiveGateway, mfInitiatePayment, tapInitiatePayment } from './payment';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_PARAMS = {
  orderId: 42,
  orderNumber: 'CVE-TEST01',
  amount: 25.500,
  currency: 'KWD',
  customer: { name: 'Ahmed Al-Rashidi', email: 'ahmed@example.com', phone: '+96512345678' },
  callbackUrl: 'https://coveinterior.com/checkout/callback?orderId=42',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getActiveGateway', () => {
  it('returns "myfatoorah" when ENV.paymentGateway is myfatoorah', async () => {
    expect(await getActiveGateway()).toBe('myfatoorah');
  });
});

describe('mfInitiatePayment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        IsSuccess: true,
        Data: { InvoiceId: 12345, PaymentURL: 'https://apitest.myfatoorah.com/pay/12345' },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls MyFatoorah ExecutePayment endpoint', async () => {
    const result = await mfInitiatePayment(SAMPLE_PARAMS);
    expect(result.gateway).toBe('myfatoorah');
    expect(result.gatewayRef).toBe('12345');
    expect(result.paymentUrl).toBe('https://apitest.myfatoorah.com/pay/12345');
    // Verify correct endpoint was called
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v2/ExecutePayment');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body.InvoiceValue).toBe(25.5);
    expect(body.CustomerName).toBe('Ahmed Al-Rashidi');
    expect(body.CustomerReference).toBe('CVE-TEST01');
  });

  it('strips country code from phone number', async () => {
    await mfInitiatePayment(SAMPLE_PARAMS);
    const fetchMock = vi.mocked(fetch);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.CustomerMobile).toBe('12345678');
    expect(body.MobileCountryCode).toBe('+965');
  });

  it('throws when API returns IsSuccess=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ IsSuccess: false, Message: 'Invalid API key' }),
    }));
    await expect(mfInitiatePayment(SAMPLE_PARAMS)).rejects.toThrow('Invalid API key');
  });
});

describe('tapInitiatePayment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chg_abc123',
        status: 'INITIATED',
        amount: 25.5,
        currency: 'KWD',
        transaction: { url: 'https://checkout.tap.company/pay/chg_abc123' },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls Tap /charges endpoint', async () => {
    const result = await tapInitiatePayment(SAMPLE_PARAMS);
    expect(result.gateway).toBe('tap');
    expect(result.gatewayRef).toBe('chg_abc123');
    expect(result.paymentUrl).toBe('https://checkout.tap.company/pay/chg_abc123');
    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v2/charges');
  });

  it('throws on Tap API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errors: [{ description: 'Invalid secret key' }] }),
    }));
    await expect(tapInitiatePayment(SAMPLE_PARAMS)).rejects.toThrow('Invalid secret key');
  });
});
