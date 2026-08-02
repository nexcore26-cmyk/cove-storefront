import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const MYFATOORAH_API_KEY = process.env.MYFATOORAH_API_KEY ?? '';
const MYFATOORAH_IS_TEST = process.env.MYFATOORAH_IS_TEST === 'true';

const BASE_URL = MYFATOORAH_IS_TEST
  ? 'https://apitest.myfatoorah.com'
  : 'https://api.myfatoorah.com';

describe('MyFatoorah API Key Validation', () => {
  it('should have MYFATOORAH_API_KEY set', () => {
    expect(MYFATOORAH_API_KEY).toBeTruthy();
    expect(MYFATOORAH_API_KEY.length).toBeGreaterThan(20);
  });

  it('should be in live mode (MYFATOORAH_IS_TEST=false)', () => {
    expect(MYFATOORAH_IS_TEST).toBe(false);
  });

  it('should authenticate successfully with the live gateway (HTTP 400 = valid key, 401 = invalid)', () => {
    // Use curl to call live MyFatoorah API
    const result = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "${BASE_URL}/v2/GetPaymentStatus" ` +
      `-H "Authorization: Bearer ${MYFATOORAH_API_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '{"Key":"test","KeyType":"PaymentId"}'`,
      { encoding: 'utf-8' }
    ).trim();

    const statusCode = parseInt(result, 10);
    // 400 = key valid but bad payment ID (expected in test)
    // 401 = unauthorized (key invalid)
    expect(statusCode).not.toBe(401);
    expect([200, 400]).toContain(statusCode);
  }, 20000);
});
