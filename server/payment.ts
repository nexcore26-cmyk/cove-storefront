/**
 * Payment Gateway Helpers — reusable provider lifecycle with native MyFatoorah.
 *
 * Cove creates its own order first, calls the active provider to create the hosted
 * payment, stores provider references, redirects the customer, and reconciles the
 * order through callback verification and webhook events. MyFatoorah is the first
 * native provider; the same interface is intentionally shaped for Upayment/Taly.
 */

import crypto from 'crypto';
import { ENV } from './_core/env';

export type PaymentGateway = 'myfatoorah' | 'tap' | 'cod' | 'upayment' | 'taly';
export type PaymentStatus = 'paid' | 'failed' | 'pending';

export interface PaymentCustomer {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface InitiatePaymentParams {
  orderId: number;
  orderNumber: string;
  amount: number;
  currency?: string;
  customer: PaymentCustomer;
  callbackUrl: string;
  errorUrl?: string;
  webhookUrl?: string;
  items?: Array<{ name: string; qty: number; unitPrice: number }>;
  paymentMethodId?: number | null;
}


export interface InitiatePaymentResult {
  paymentUrl: string;
  gatewayRef: string;
  gateway: PaymentGateway;
  invoiceId?: string;
  paymentId?: string;
  providerData?: Record<string, any>;
}

export interface VerifyPaymentOptions {
  paymentId?: string | null;
  invoiceId?: string | null;
  keyType?: 'InvoiceId' | 'PaymentId' | 'CustomerReference';
}

export interface VerifyPaymentResult {
  status: PaymentStatus;
  transactionId?: string;
  paymentId?: string;
  invoiceId?: string;
  invoiceReference?: string;
  referenceId?: string;
  gatewayName?: string;
  amount?: number;
  currency?: string;
  providerStatus?: string;
  providerData?: Record<string, any>;
}

export interface MyFatoorahSettings {
  apiKey: string;
  webhookSecret?: string;
  countryCode: string;
  isTest: boolean;
}

function sanitizeMfApiKey(apiKey?: string | null): string {
  return (apiKey || '').trim().replace(/^Bearer\s+/i, '').trim();
}

function sanitizeSecret(secret?: string | null): string {
  return (secret || '').trim();
}

export async function getMfSettings(): Promise<MyFatoorahSettings> {
  try {
    const { getDb } = await import('./db');
    const { storeSettings } = await import('../drizzle/schema');
    const db = await getDb();
    if (db) {
      const [row] = await db.select().from(storeSettings).limit(1);
      if (row) {
        return {
          apiKey: sanitizeMfApiKey((row as any).myfatoorahApiKey || ENV.myfatoorahApiKey || ''),
          webhookSecret: sanitizeSecret((row as any).myfatoorahWebhookSecret || ENV.myfatoorahWebhookSecret || ''),
          countryCode: String((row as any).myfatoorahCountryCode || ENV.myfatoorahCountryCode || 'KWT').toUpperCase(),
          isTest: (row as any).myfatoorahIsTest != null ? Boolean((row as any).myfatoorahIsTest) : ENV.myfatoorahIsTest,
        };
      }
    }
  } catch {
    // Fall back to ENV if DB is unavailable.
  }
  return {
    apiKey: sanitizeMfApiKey(ENV.myfatoorahApiKey || ''),
    webhookSecret: sanitizeSecret(ENV.myfatoorahWebhookSecret || ''),
    countryCode: String(ENV.myfatoorahCountryCode || 'KWT').toUpperCase(),
    isTest: ENV.myfatoorahIsTest,
  };
}

const MF_TEST_BASE = 'https://apitest.myfatoorah.com';
const MF_LIVE_BASE = 'https://api.myfatoorah.com';

function getMfBase(isTest: boolean, _countryCode = 'KWT'): string {
  return isTest ? MF_TEST_BASE : MF_LIVE_BASE;
}

async function mfPost<T>(path: string, body: object, apiKey?: string, isTest?: boolean): Promise<T> {
  let key = sanitizeMfApiKey(apiKey);
  let testMode = isTest;
  let countryCode = 'KWT';
  if (!key || testMode === undefined) {
    const settings = await getMfSettings();
    key = key || settings.apiKey;
    testMode = testMode ?? settings.isTest;
    countryCode = settings.countryCode;
  }
  if (!key) throw new Error('MYFATOORAH_API_KEY is not configured');
  const res = await fetch(`${getMfBase(Boolean(testMode), countryCode)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok || data.IsSuccess === false) {
    const providerErrors = data.ValidationErrors || data.FieldsErrors || data.Errors || null;
    const details = providerErrors ? ` (${JSON.stringify(providerErrors)})` : '';
    const message = data.Message || data.ErrorMessage || `MyFatoorah API error: ${res.status}`;
    console.error('[MyFatoorah] API request failed', {
      path,
      status: res.status,
      message,
      validationErrors: providerErrors,
      request: redactMfRequest(body),
    });
    throw new Error(`${message}${details}`);
  }
  return data.Data as T;
}

function redactMfRequest(body: object): Record<string, any> {
  const copy = { ...(body as Record<string, any>) };
  if (copy.CustomerEmail) copy.CustomerEmail = '[set]';
  if (copy.CustomerMobile) copy.CustomerMobile = '[set]';
  return copy;
}

interface MfPaymentMethod {
  PaymentMethodId: number;
  PaymentMethodEn?: string;
  PaymentMethodAr?: string;
  PaymentMethodCode?: string;
  IsDirectPayment?: boolean;
  PaymentCurrencyIso?: string;
  ImageUrl?: string;
  ServiceCharge?: number;
  TotalAmount?: number;
}

export interface MyFatoorahPaymentOption {
  id: number;
  name: string;
  code?: string;
  direct: boolean;
  currency?: string;
  imageUrl?: string;
  serviceCharge?: number;
  totalAmount?: number;
}

async function getMfPaymentMethods(invoiceValue: number, currency: string): Promise<MfPaymentMethod[]> {
  const data = await mfPost<{ PaymentMethods?: MfPaymentMethod[] }>('/v2/InitiatePayment', {
    InvoiceAmount: invoiceValue,
    CurrencyIso: currency || 'KWD',
  });
  return Array.isArray(data?.PaymentMethods) ? data.PaymentMethods : [];
}

function mapMfPaymentOption(method: MfPaymentMethod): MyFatoorahPaymentOption {
  return {
    id: Number(method.PaymentMethodId),
    name: method.PaymentMethodEn || method.PaymentMethodAr || method.PaymentMethodCode || `Payment Method ${method.PaymentMethodId}`,
    code: method.PaymentMethodCode,
    direct: Boolean(method.IsDirectPayment),
    currency: method.PaymentCurrencyIso,
    imageUrl: method.ImageUrl,
    serviceCharge: method.ServiceCharge,
    totalAmount: method.TotalAmount,
  };
}

export async function listMfPaymentMethods(params: { amount: number; currency?: string }): Promise<MyFatoorahPaymentOption[]> {
  const invoiceValue = parseFloat(Number(params.amount || 0).toFixed(3));
  if (!Number.isFinite(invoiceValue) || invoiceValue <= 0) return [];
  const currency = params.currency || 'KWD';
  const methods = await getMfPaymentMethods(invoiceValue, currency);
  return methods
    .filter((method) => Number(method.PaymentMethodId) > 0)
    .map(mapMfPaymentOption);
}

function chooseMfPaymentMethod(methods: MfPaymentMethod[], currency: string, preferredPaymentMethodId?: number | null): MfPaymentMethod | undefined {
  const enabled = methods.filter((method) => Number(method.PaymentMethodId) > 0);
  const sameCurrency = enabled.filter((method) => !method.PaymentCurrencyIso || method.PaymentCurrencyIso === currency);
  const pool = sameCurrency.length ? sameCurrency : enabled;

  if (preferredPaymentMethodId) {
    const preferred = pool.find((method) => Number(method.PaymentMethodId) === Number(preferredPaymentMethodId));
    if (preferred) return preferred;
  }

  // Fallback: prefer the hosted VISA/MASTER page, then any enabled hosted method,
  // preserving the currently working behavior when the customer has not chosen a method.
  const byCard = pool.find((method) => {
    const label = `${method.PaymentMethodEn || ''} ${method.PaymentMethodCode || ''}`.toLowerCase();
    return !method.IsDirectPayment && (label.includes('visa') || label.includes('master') || label.includes('vm'));
  });
  return byCard || pool.find((method) => !method.IsDirectPayment) || pool[0];
}

function normalizeMfCustomerName(name: string): string {
  const safe = (name || 'Customer')
    .replace(/[<>]/g, '')
    .replace(/[^A-Za-z0-9\u0600-\u06FF\s._@+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || 'Customer';
}

function normalizeKuwaitPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const stripped = phone.replace(/^\+965/, '').replace(/^00965/, '').replace(/\D/g, '');
  // MyFatoorah CustomerMobile accepts up to 11 English digits. If the checkout
  // value includes another country code or an invalid long number, omit it rather
  // than letting the provider reject the whole invoice as invalid data.
  if (!stripped || stripped.length > 11) return undefined;
  return stripped;
}

export async function mfInitiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  const invoiceValue = parseFloat(params.amount.toFixed(3));
  const currency = params.currency || 'KWD';
  let invoiceItems = params.items?.map((item) => ({
    ItemName: String(item.name || 'Item').replace(/[<>]/g, '').slice(0, 255),
    Quantity: Number(item.qty),
    UnitPrice: parseFloat(Number(item.unitPrice || 0).toFixed(3)),
  })).filter((item) => item.Quantity > 0 && item.UnitPrice >= 0);

  if (invoiceItems?.length) {
    const itemsTotal = invoiceItems.reduce((sum, item) => sum + item.Quantity * item.UnitPrice, 0);
    if (Math.abs(itemsTotal - invoiceValue) > 0.001) invoiceItems = undefined;
  }

  const methods = await getMfPaymentMethods(invoiceValue, currency);
  const selectedMethod = chooseMfPaymentMethod(methods, currency, params.paymentMethodId);
  if (!selectedMethod) throw new Error('No enabled MyFatoorah payment methods are available for this order');

  const body: Record<string, any> = {
    PaymentMethodId: Number(selectedMethod.PaymentMethodId),
    CustomerName: normalizeMfCustomerName(params.customer.name),
    InvoiceValue: invoiceValue,
    DisplayCurrencyIso: currency,
    Language: 'en',
    CustomerReference: String(params.orderNumber),
    UserDefinedField: String(params.orderId),
    CallBackUrl: params.callbackUrl,
    ErrorUrl: params.errorUrl || params.callbackUrl,
    SourceInfo: 'Cove Commerce OS Node',
  };

  if (params.customer.email) body.CustomerEmail = params.customer.email;
  const phone = normalizeKuwaitPhone(params.customer.phone);
  if (phone) {
    body.MobileCountryCode = '965';
    body.CustomerMobile = phone;
  }
  if (invoiceItems?.length) body.InvoiceItems = invoiceItems;
  if (params.webhookUrl) body.WebhookUrl = params.webhookUrl;

  const data = await mfPost<any>('/v2/ExecutePayment', body);
  const invoiceId = String(data.InvoiceId ?? '');
  return {
    paymentUrl: data.PaymentURL,
    gatewayRef: invoiceId,
    gateway: 'myfatoorah',
    invoiceId,
    providerData: {
      executePayment: data,
      selectedMethod,
      availableMethods: methods.map((method) => ({
        id: method.PaymentMethodId,
        name: method.PaymentMethodEn || method.PaymentMethodAr || method.PaymentMethodCode,
        code: method.PaymentMethodCode,
        direct: method.IsDirectPayment,
        currency: method.PaymentCurrencyIso,
      })),
      request: redactMfRequest(body),
    },
  };
}

function mapMfInvoiceStatus(invoiceStatus?: string, transactionStatus?: string): PaymentStatus {
  const invoice = String(invoiceStatus || '').toLowerCase();
  const tx = String(transactionStatus || '').toLowerCase();
  if (invoice === 'paid' || tx === 'success' || tx === 'paid' || tx === 'duplicatepayment') return 'paid';
  if (invoice === 'failed' || invoice === 'expired' || tx === 'failed' || tx === 'canceled' || tx === 'cancelled') return 'failed';
  return 'pending';
}

export async function mfVerifyPayment(gatewayRef: string, options: VerifyPaymentOptions = {}): Promise<VerifyPaymentResult> {
  const key = options.paymentId || options.invoiceId || gatewayRef;
  const keyType = options.paymentId ? 'PaymentId' : options.keyType || 'InvoiceId';
  const data = await mfPost<any>('/v2/GetPaymentStatus', { Key: key, KeyType: keyType });
  const tx = Array.isArray(data.InvoiceTransactions) ? data.InvoiceTransactions[0] : undefined;
  const status = mapMfInvoiceStatus(data.InvoiceStatus, tx?.TransactionStatus || tx?.Error);
  const invoiceId = data.InvoiceId != null ? String(data.InvoiceId) : (options.invoiceId || gatewayRef || undefined);
  const paymentId = tx?.PaymentId != null ? String(tx.PaymentId) : (options.paymentId || undefined);
  return {
    status,
    transactionId: tx?.TransactionId != null ? String(tx.TransactionId) : undefined,
    paymentId,
    invoiceId,
    invoiceReference: data.InvoiceReference != null ? String(data.InvoiceReference) : undefined,
    referenceId: tx?.ReferenceId != null ? String(tx.ReferenceId) : undefined,
    gatewayName: tx?.PaymentGateway || tx?.PaymentGatewayName || undefined,
    amount: tx?.PaidCurrencyValue ?? data.InvoiceValue ?? undefined,
    currency: tx?.PaidCurrency ?? data.CurrencyIso ?? undefined,
    providerStatus: data.InvoiceStatus,
    providerData: { getPaymentStatus: data, keyType },
  };
}

export async function mfTestConnection(params?: { apiKey?: string; isTest?: boolean }) {
  const settings = await getMfSettings();
  const apiKey = sanitizeMfApiKey(params?.apiKey || settings.apiKey);
  const isTest = params?.isTest ?? settings.isTest;
  if (!apiKey) throw new Error('MyFatoorah API key is not configured');
  const data = await mfPost<any>('/v2/InitiatePayment', { InvoiceAmount: 1, CurrencyIso: 'KWD' }, apiKey, isTest);
  const methods = Array.isArray(data?.PaymentMethods)
    ? data.PaymentMethods.map((method: any) => method.PaymentMethodEn || method.PaymentMethodAr || method.PaymentMethodCode).filter(Boolean)
    : [];
  return { ok: true, mode: isTest ? 'test' : 'live', baseUrl: getMfBase(isTest, settings.countryCode), methods };
}

export interface RefundResult {
  refundId: string;
  status: 'success' | 'failed';
  message?: string;
}

export async function mfMakeRefund(params: { gatewayRef: string; amount: number; comment?: string }): Promise<RefundResult> {
  try {
    const data = await mfPost<any>('/v2/MakeRefund', {
      Key: params.gatewayRef,
      KeyType: 'InvoiceId',
      RefundChargeOnCustomer: false,
      ServiceChargeOnCustomer: false,
      Amount: parseFloat(params.amount.toFixed(3)),
      Comment: params.comment || 'Refund',
      AmountDeductedFromSupplier: 0,
    });
    return { refundId: String(data.RefundId ?? data.refundId ?? ''), status: 'success' };
  } catch (err: any) {
    return { refundId: '', status: 'failed', message: err?.message || 'Refund failed' };
  }
}

const TAP_BASE = 'https://api.tap.company/v2';

async function tapPost<T>(path: string, body: object): Promise<T> {
  const secretKey = ENV.tapSecretKey;
  if (!secretKey) throw new Error('TAP_SECRET_KEY is not configured');
  const res = await fetch(`${TAP_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secretKey}` },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.errors?.[0]?.description || `Tap API error: ${res.status}`);
  return data as T;
}

async function tapGet<T>(path: string): Promise<T> {
  const secretKey = ENV.tapSecretKey;
  if (!secretKey) throw new Error('TAP_SECRET_KEY is not configured');
  const res = await fetch(`${TAP_BASE}${path}`, { headers: { Authorization: `Bearer ${secretKey}` } });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.errors?.[0]?.description || `Tap API error: ${res.status}`);
  return data as T;
}

export async function tapInitiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  const body: any = {
    amount: parseFloat(params.amount.toFixed(3)),
    currency: params.currency || 'KWD',
    customer: {
      first_name: params.customer.name,
      email: params.customer.email || undefined,
      phone: params.customer.phone ? { country_code: '965', number: params.customer.phone.replace(/^\+965/, '').replace(/\D/g, '') } : undefined,
    },
    source: { id: 'src_all' },
    redirect: { url: params.callbackUrl },
    reference: { merchant: String(params.orderNumber) },
    description: `Order #${params.orderNumber}`,
  };
  const data = await tapPost<any>('/charges', body);
  return { paymentUrl: data.transaction?.url, gatewayRef: data.id, gateway: 'tap', providerData: { charge: data } };
}

export async function tapVerifyPayment(gatewayRef: string): Promise<VerifyPaymentResult> {
  const data = await tapGet<any>(`/charges/${gatewayRef}`);
  return {
    status: data.status === 'CAPTURED' ? 'paid' : data.status === 'FAILED' ? 'failed' : 'pending',
    transactionId: data.id,
    amount: data.amount,
    currency: data.currency,
    providerStatus: data.status,
    providerData: { charge: data },
  };
}

export async function getActiveGateway(): Promise<PaymentGateway> {
  try {
    const { getDb } = await import('./db');
    const { storeSettings } = await import('../drizzle/schema');
    const db = await getDb();
    if (db) {
      const [row] = await db.select().from(storeSettings).limit(1);
      if (row && (row as any).activeGateway) return (row as any).activeGateway as PaymentGateway;
    }
  } catch {}
  return (ENV.paymentGateway as PaymentGateway) || 'myfatoorah';
}

export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  const gateway = await getActiveGateway();
  if (gateway === 'tap') return tapInitiatePayment(params);
  if (gateway === 'upayment' || gateway === 'taly') throw new Error(`${gateway} gateway is not implemented yet`);
  return mfInitiatePayment(params);
}

export async function verifyPayment(gatewayRef: string, gateway?: PaymentGateway, options: VerifyPaymentOptions = {}): Promise<VerifyPaymentResult> {
  const gw = gateway || await getActiveGateway();
  if (gw === 'tap') return tapVerifyPayment(gatewayRef);
  if (gw === 'upayment' || gw === 'taly') throw new Error(`${gw} gateway is not implemented yet`);
  return mfVerifyPayment(gatewayRef, options);
}

function extractMfV2SignatureData(eventCode: number, data: any): Record<string, any> {
  if (eventCode === 1) {
    return {
      'Invoice.Id': data?.Invoice?.Id,
      'Invoice.Status': data?.Invoice?.Status,
      'Transaction.Status': data?.Transaction?.Status,
      'Transaction.PaymentId': data?.Transaction?.PaymentId,
      'Invoice.ExternalIdentifier': data?.Invoice?.ExternalIdentifier,
    };
  }
  if (eventCode === 2) {
    return {
      'Refund.Id': data?.Refund?.Id,
      'Refund.Status': data?.Refund?.Status,
      'Amount.ValueInBaseCurrency': data?.Amount?.ValueInBaseCurrency,
      'ReferencedInvoice.Id': data?.ReferencedInvoice?.Id,
    };
  }
  throw new Error('Unsupported MyFatoorah webhook event code');
}

function canonicalMfSignatureString(dataModel: Record<string, any>): string {
  return Object.keys(dataModel)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((key) => `${key}=${dataModel[key] ?? ''}`)
    .join(',');
}

export function verifyMyFatoorahWebhookSignature(params: { payload: any; signature?: string | string[]; version?: string | string[]; secret: string }): boolean {
  const signature = Array.isArray(params.signature) ? params.signature[0] : params.signature;
  const version = (Array.isArray(params.version) ? params.version[0] : params.version || '').toLowerCase();
  if (!params.secret || !signature || !version) return false;

  let model: Record<string, any>;
  if (version === 'v2') {
    const code = Number(params.payload?.Event?.Code);
    model = extractMfV2SignatureData(code, params.payload?.Data || {});
  } else if (version === 'v1') {
    model = { ...(params.payload?.Data || {}) };
    if (Number(params.payload?.EventType) === 2) delete model.GatewayReference;
  } else {
    return false;
  }

  const canonical = canonicalMfSignatureString(model);
  const hash = crypto.createHmac('sha256', params.secret).update(canonical).digest('base64');
  const expected = Buffer.from(hash);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function mapMyFatoorahWebhookToResult(payload: any): { orderId?: number; invoiceId?: string; result: VerifyPaymentResult } {
  const eventCode = Number(payload?.Event?.Code);
  if (eventCode !== 1) throw new Error('Unsupported MyFatoorah webhook event');
  const data = payload?.Data || {};
  const invoice = data.Invoice || {};
  const tx = data.Transaction || {};
  const externalIdentifier = invoice.ExternalIdentifier ?? invoice.CustomerReference;
  const orderId = externalIdentifier != null && /^\d+$/.test(String(externalIdentifier)) ? Number(externalIdentifier) : undefined;
  const invoiceId = invoice.Id != null ? String(invoice.Id) : undefined;
  const paymentId = tx.PaymentId != null ? String(tx.PaymentId) : undefined;
  const txStatus = tx.Status != null ? String(tx.Status) : undefined;
  const invoiceStatus = invoice.Status != null ? String(invoice.Status) : undefined;
  return {
    orderId,
    invoiceId,
    result: {
      status: mapMfInvoiceStatus(invoiceStatus, txStatus),
      invoiceId,
      paymentId,
      transactionId: tx.Id != null ? String(tx.Id) : undefined,
      referenceId: tx.ReferenceId != null ? String(tx.ReferenceId) : undefined,
      gatewayName: tx.PaymentMethod || tx.PaymentGateway || undefined,
      amount: data.Amount?.ValueInDisplayCurrency ?? data.Amount?.ValueInBaseCurrency ?? undefined,
      currency: data.Amount?.DisplayCurrency ?? data.Amount?.BaseCurrency ?? undefined,
      providerStatus: txStatus || invoiceStatus,
      providerData: { webhook: payload },
    },
  };
}

export async function findOrderIdForPaymentResult(result: VerifyPaymentResult): Promise<number | undefined> {
  const { getDb } = await import('./db');
  const { orders } = await import('../drizzle/schema');
  const { eq, or } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  const conditions: any[] = [];
  if (result.invoiceId) {
    conditions.push(eq((orders as any).paymentInvoiceId, result.invoiceId));
    conditions.push(eq((orders as any).gatewayRef, result.invoiceId));
    conditions.push(eq((orders as any).paymentReference, result.invoiceId));
  }
  if (result.paymentId) conditions.push(eq((orders as any).paymentId, result.paymentId));
  if (result.transactionId) conditions.push(eq((orders as any).paymentTransactionId, result.transactionId));
  if (!conditions.length) return undefined;

  const [order] = await db.select({ id: orders.id }).from(orders).where(or(...conditions)).limit(1);
  return order?.id;
}

export async function applyPaymentResultToOrder(orderId: number, result: VerifyPaymentResult): Promise<{ status: PaymentStatus | 'paid_stock_error'; transactionId?: string }> {
  const { getDb } = await import('./db');
  const { orders } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error('Order not found');

  if (result.invoiceId && (order as any).gatewayRef && String((order as any).gatewayRef) !== String(result.invoiceId)) {
    throw new Error('Webhook invoice does not match stored order invoice');
  }

  if ((order as any).paymentStatus === 'paid') {
    return { status: 'paid', transactionId: result.transactionId };
  }

  const updateData: any = {
    paymentStatus: result.status,
    paymentInvoiceId: result.invoiceId ?? (order as any).paymentInvoiceId ?? (order as any).gatewayRef,
    paymentId: result.paymentId ?? (order as any).paymentId,
    paymentTransactionId: result.transactionId ?? (order as any).paymentTransactionId,
    paymentGatewayName: result.gatewayName ?? (order as any).paymentGatewayName,
    paymentProviderData: result.providerData ?? (order as any).paymentProviderData,
  };

  if (result.invoiceId) {
    updateData.gatewayRef = result.invoiceId;
    updateData.paymentReference = result.invoiceId;
  }

  if (result.status === 'paid') {
    if ((order as any).status === 'pending') {
      try {
        const alreadyDeductedAtPlacement = String((order as any).internalNotes || '').includes('[system:stock_deducted_at_order_placement:');
        if (!alreadyDeductedAtPlacement) {
          const { deductStockForOrder } = await import('./db');
          await deductStockForOrder(orderId);
        }
        updateData.paidAt = new Date();
        updateData.status = 'processing';
      } catch (stockErr: any) {
        updateData.status = 'failed';
        await db.update(orders).set(updateData).where(eq(orders.id, orderId));
        const { notifyOwner } = await import('./_core/notification');
        await notifyOwner({
          title: 'URGENT: Stock deduction failed after payment',
          content: `Order #${orderId} was paid (ref: ${result.invoiceId || (order as any).paymentReference}) but stock could not be deducted. Reason: ${stockErr.message}. A refund may be required.`,
        });
        return { status: 'paid_stock_error', transactionId: result.transactionId };
      }
    } else {
      updateData.status = (order as any).status;
      updateData.paidAt = (order as any).paidAt ?? new Date();
    }
  } else if (result.status === 'failed') {
    updateData.status = 'failed';
  }

  await db.update(orders).set(updateData).where(eq(orders.id, orderId));
  return { status: result.status, transactionId: result.transactionId };
}
