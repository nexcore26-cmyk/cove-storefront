/**
 * AdminPaymentGateways — Dedicated payment gateway management page
 * Design: Obsidian Editorial
 *
 * Gateways:
 *  - MyFatoorah: active (KNET, Visa, Mastercard, Apple Pay)
 *  - uPayment: coming soon
 *  - Taly: coming soon
 *
 * Features:
 *  - Per-gateway enable/disable (only one active at a time)
 *  - API key management (masked display, reveal on click)
 *  - Test/Live mode toggle for MyFatoorah
 *  - Cash on Delivery toggle (shown alongside active gateway)
 */
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  CreditCard, Eye, EyeOff, Loader2, CheckCircle2, Clock, Shield, Banknote,
  ChevronRight, AlertCircle
} from 'lucide-react';

type GatewayId = 'myfatoorah' | 'upayment' | 'taly';

interface GatewayDef {
  id: GatewayId;
  name: string;
  description: string;
  methods: string;
  status: 'active' | 'coming_soon';
  color: string;
  hasApiKey: boolean;
  hasTestMode: boolean;
}

const GATEWAYS: GatewayDef[] = [
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    description: 'Kuwait\'s leading payment gateway. Supports KNET, Visa, Mastercard, and Apple Pay with a hosted payment page.',
    methods: 'KNET · Visa · Mastercard · Apple Pay · STC Pay',
    status: 'active',
    color: '#1A5276',
    hasApiKey: true,
    hasTestMode: true,
  },
  {
    id: 'upayment',
    name: 'uPayment',
    description: 'Kuwait-based payment gateway with support for KNET and major card networks.',
    methods: 'KNET · Visa · Mastercard',
    status: 'coming_soon',
    color: '#6C3483',
    hasApiKey: true,
    hasTestMode: false,
  },
  {
    id: 'taly',
    name: 'Taly',
    description: 'Buy now, pay later solution for GCC markets. Split purchases into installments.',
    methods: 'Buy Now Pay Later · Installments',
    status: 'coming_soon',
    color: '#1E8449',
    hasApiKey: true,
    hasTestMode: false,
  },
];

export default function AdminPaymentGateways() {
  const { data: storeSettings, isLoading } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => toast.success('Payment settings saved'),
    onError: (e) => toast.error(e.message || 'Failed to save settings'),
  });
  const testMyfatoorah = trpc.settings.testMyfatoorah.useMutation({
    onSuccess: (result) => {
      const mode = result.mode === 'live' ? 'Live' : 'Test';
      toast.success(`MyFatoorah ${mode} connection successful`);
    },
    onError: (e) => toast.error(e.message || 'MyFatoorah connection test failed'),
  });

  // State
  const [activeGateway, setActiveGateway] = useState<GatewayId>('myfatoorah');
  const [codEnabled, setCodEnabled] = useState(false);
  const [myfatoorahApiKey, setMyfatoorahApiKey] = useState('');
  const [myfatoorahWebhookSecret, setMyfatoorahWebhookSecret] = useState('');
  const [myfatoorahCountryCode, setMyfatoorahCountryCode] = useState('KWT');
  const [myfatoorahIsTest, setMyfatoorahIsTest] = useState(false);
  const [upaymentApiKey, setUpaymentApiKey] = useState('');
  const [talyApiKey, setTalyApiKey] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Load from DB
  useEffect(() => {
    if (!storeSettings) return;
    const s = storeSettings as any;
    setActiveGateway((s.activeGateway as GatewayId) || 'myfatoorah');
    setCodEnabled(!!s.codEnabled);
    setMyfatoorahApiKey(s.myfatoorahApiKey || '');
    setMyfatoorahWebhookSecret(s.myfatoorahWebhookSecret || '');
    setMyfatoorahCountryCode(s.myfatoorahCountryCode || 'KWT');
    setMyfatoorahIsTest(!!s.myfatoorahIsTest);
    setUpaymentApiKey(s.upaymentApiKey || '');
    setTalyApiKey(s.talyApiKey || '');
  }, [storeSettings]);

  const handleSave = () => {
    updateSettings.mutate({
      activeGateway,
      codEnabled,
      myfatoorahApiKey: myfatoorahApiKey || undefined,
      myfatoorahWebhookSecret: myfatoorahWebhookSecret || undefined,
      myfatoorahCountryCode: myfatoorahCountryCode || 'KWT',
      myfatoorahIsTest,
      upaymentApiKey: upaymentApiKey || undefined,
      talyApiKey: talyApiKey || undefined,
    });
  };

  const handleTestMyfatoorah = () => {
    testMyfatoorah.mutate({
      apiKey: myfatoorahApiKey || undefined,
      isTest: myfatoorahIsTest,
    });
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 6) + '••••••••••••••••' + key.substring(key.length - 4);
  };

  const toggleShowKey = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getKeyValue = (id: GatewayId) => {
    if (id === 'myfatoorah') return myfatoorahApiKey;
    if (id === 'upayment') return upaymentApiKey;
    if (id === 'taly') return talyApiKey;
    return '';
  };

  const setKeyValue = (id: GatewayId, val: string) => {
    if (id === 'myfatoorah') setMyfatoorahApiKey(val);
    else if (id === 'upayment') setUpaymentApiKey(val);
    else if (id === 'taly') setTalyApiKey(val);
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-1"
            style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
            Admin
          </p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}>
            Payment Gateways
          </h1>
          <p className="text-xs mt-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
            Configure provider credentials supplied by the merchant, activate one online gateway, and keep Direct Link available as an operational fallback.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={20} style={{ color: '#9D7D39' }} />
            <span className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>Loading settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gateway Cards */}
            {GATEWAYS.map((gw) => {
              const isSelected = activeGateway === gw.id;
              const keyVal = getKeyValue(gw.id);
              const isComingSoon = gw.status === 'coming_soon';

              return (
                <div
                  key={gw.id}
                  className="bg-white rounded-lg border shadow-sm overflow-hidden transition-all"
                  style={{
                    borderColor: isSelected ? '#9D7D39' : '#E8E4DC',
                    opacity: isComingSoon ? 0.7 : 1,
                  }}
                >
                  {/* Card Header */}
                  <div className="p-5 flex items-start gap-4">
                    {/* Gateway icon/color indicator */}
                    <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: gw.color + '18' }}>
                      <CreditCard size={20} style={{ color: gw.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                          {gw.name}
                        </h3>
                        {isComingSoon ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                            style={{ backgroundColor: '#F0EDE8', color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            <Clock size={10} /> Coming Soon
                          </span>
                        ) : isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full"
                            style={{ backgroundColor: 'rgba(157,125,57,0.12)', color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs mb-2" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        {gw.description}
                      </p>
                      <p className="text-[10px] font-semibold tracking-wider" style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}>
                        {gw.methods}
                      </p>
                    </div>

                    {/* Select button */}
                    {!isComingSoon && (
                      <button
                        onClick={() => setActiveGateway(gw.id)}
                        className="shrink-0 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase border transition-all"
                        style={{
                          borderColor: isSelected ? '#9D7D39' : '#E8E4DC',
                          color: isSelected ? '#9D7D39' : '#8A8A82',
                          backgroundColor: isSelected ? 'rgba(157,125,57,0.06)' : 'transparent',
                          fontFamily: 'Montserrat, sans-serif',
                        }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    )}
                  </div>

                  {/* Expanded config (only when selected or always for API key management) */}
                  {!isComingSoon && (
                    <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: '#F0EDE8', backgroundColor: '#FAFAF8' }}>
                      {/* API Key */}
                      {gw.hasApiKey && (
                        <div>
                          <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5"
                            style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            API Secret Key
                          </label>
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <input
                                type={showKeys[gw.id] ? 'text' : 'password'}
                                value={keyVal}
                                onChange={(e) => setKeyValue(gw.id, e.target.value)}
                                placeholder={`Enter ${gw.name} API key...`}
                                className="w-full px-3 py-2 text-xs border bg-white focus:outline-none"
                                style={{
                                  borderColor: '#E8E4DC',
                                  fontFamily: 'Montserrat, sans-serif',
                                  color: '#242424',
                                  letterSpacing: showKeys[gw.id] ? 'normal' : '0.1em',
                                }}
                              />
                            </div>
                            <button
                              onClick={() => toggleShowKey(gw.id)}
                              className="px-3 py-2 border text-xs"
                              style={{ borderColor: '#E8E4DC', color: '#8A8A82' }}
                              title={showKeys[gw.id] ? 'Hide key' : 'Show key'}
                            >
                              {showKeys[gw.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          {keyVal && (
                            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#6B9E6B', fontFamily: 'Montserrat, sans-serif' }}>
                              <Shield size={10} /> Key configured ({keyVal.length} characters)
                            </p>
                          )}
                          {!keyVal && (
                            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#C0392B', fontFamily: 'Montserrat, sans-serif' }}>
                              <AlertCircle size={10} /> No API key configured — payments will fail
                            </p>
                          )}
                        </div>
                      )}



                          {gw.id === 'myfatoorah' && (
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5"
                                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                  Vendor Country
                                </label>
                                <select
                                  value={myfatoorahCountryCode}
                                  onChange={(e) => setMyfatoorahCountryCode(e.target.value)}
                                  className="w-full px-3 py-2 text-xs border bg-white focus:outline-none"
                                  style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                                >
                                  <option value="KWT">Kuwait</option>
                                  <option value="SAU">Saudi Arabia</option>
                                  <option value="ARE">United Arab Emirates</option>
                                  <option value="BHR">Bahrain</option>
                                  <option value="QAT">Qatar</option>
                                  <option value="OMN">Oman</option>
                                </select>
                                <p className="text-[10px] mt-1" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                  Match the country selected in the MyFatoorah merchant account.
                                </p>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5"
                                  style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                                  Webhook Secret Key
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type={showKeys.myfatoorahWebhook ? 'text' : 'password'}
                                    value={myfatoorahWebhookSecret}
                                    onChange={(e) => setMyfatoorahWebhookSecret(e.target.value)}
                                    placeholder="Paste MyFatoorah webhook secret..."
                                    className="flex-1 px-3 py-2 text-xs border bg-white focus:outline-none"
                                    style={{ borderColor: '#E8E4DC', fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
                                  />
                                  <button
                                    onClick={() => toggleShowKey('myfatoorahWebhook')}
                                    className="px-3 py-2 border text-xs"
                                    style={{ borderColor: '#E8E4DC', color: '#8A8A82' }}
                                    title={showKeys.myfatoorahWebhook ? 'Hide webhook secret' : 'Show webhook secret'}
                                  >
                                    {showKeys.myfatoorahWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: myfatoorahWebhookSecret ? '#6B9E6B' : '#C0392B', fontFamily: 'Montserrat, sans-serif' }}>
                                  {myfatoorahWebhookSecret ? 'Webhook signature validation is configured.' : 'Required for secure automatic order reconciliation.'}
                                </p>
                              </div>
                            </div>
                          )}

                      {/* Test / Live mode toggle (MyFatoorah only) */}
                      {gw.hasTestMode && (
                        <div>
                          <label className="block text-[10px] font-semibold tracking-wider uppercase mb-2"
                            style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                            Mode
                          </label>
                          <div className="flex gap-2">
                            {[
                              { val: false, label: 'Live', desc: 'Real payments', color: '#1E8449' },
                              { val: true, label: 'Test', desc: 'Sandbox / demo cards', color: '#E67E22' },
                            ].map((mode) => (
                              <button
                                key={String(mode.val)}
                                onClick={() => setMyfatoorahIsTest(mode.val)}
                                className="flex-1 flex items-center gap-2 px-3 py-2 border text-left transition-all"
                                style={{
                                  borderColor: myfatoorahIsTest === mode.val ? mode.color : '#E8E4DC',
                                  backgroundColor: myfatoorahIsTest === mode.val ? mode.color + '10' : 'transparent',
                                }}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: myfatoorahIsTest === mode.val ? mode.color : '#D1CEC8' }} />
                                <div>
                                  <p className="text-[10px] font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>{mode.label}</p>
                                  <p className="text-[9px]" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>{mode.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          {myfatoorahIsTest && (
                            <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#E67E22', fontFamily: 'Montserrat, sans-serif' }}>
                              <AlertCircle size={10} /> Test mode active — use demo cards only, no real charges
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Cash on Delivery */}
            <div className="bg-white rounded-lg border shadow-sm p-5" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(139,90,43,0.1)' }}>
                  <Banknote size={20} style={{ color: '#8B5A2B' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-0.5" style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}>
                        Direct Link / Pay by Arrangement
                      </h3>
                      <p className="text-xs" style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}>
                        Allow customers to place an order while online gateway support is pending. When enabled, checkout shows a Direct Link option so the team can send a payment link or arrange collection manually.
                      </p>
                    </div>
                    {/* Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <div className="relative" onClick={() => setCodEnabled(!codEnabled)}>
                        <div className="w-11 h-6 rounded-full transition-colors cursor-pointer"
                          style={{ backgroundColor: codEnabled ? '#9D7D39' : '#D1CEC8' }} />
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                          style={{ transform: codEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ fontFamily: 'Montserrat, sans-serif', color: codEnabled ? '#9D7D39' : '#8A8A82' }}>
                        {codEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Test Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="flex items-center gap-2 px-6 py-3 text-xs font-semibold tracking-wider uppercase disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
              >
                {updateSettings.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving...</>
                ) : (
                  <>Save Payment Settings <ChevronRight size={14} /></>
                )}
              </button>
              <button
                onClick={handleTestMyfatoorah}
                disabled={testMyfatoorah.isPending || !myfatoorahApiKey}
                className="flex items-center gap-2 px-6 py-3 text-xs font-semibold tracking-wider uppercase border disabled:opacity-50 transition-opacity"
                style={{ borderColor: '#9D7D39', color: '#9D7D39', backgroundColor: 'transparent', fontFamily: 'Montserrat, sans-serif' }}
              >
                {testMyfatoorah.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Testing...</>
                ) : (
                  <>Test MyFatoorah Connection</>
                )}
              </button>
              {updateSettings.isSuccess && (
                <span className="text-xs flex items-center gap-1" style={{ color: '#6B9E6B', fontFamily: 'Montserrat, sans-serif' }}>
                  <CheckCircle2 size={14} /> Saved successfully
                </span>
              )}
            </div>
            {testMyfatoorah.isSuccess && testMyfatoorah.data && (
              <div className="rounded border p-4 text-xs" style={{ borderColor: '#D8E8D8', backgroundColor: '#F7FBF7', color: '#2E6B2E', fontFamily: 'Montserrat, sans-serif' }}>
                <p className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[10px] mb-1">
                  <CheckCircle2 size={14} /> MyFatoorah connection verified
                </p>
                <p>Mode: {testMyfatoorah.data.mode === 'live' ? 'Live payments' : 'Test / sandbox'}</p>
                <p>Endpoint: {testMyfatoorah.data.baseUrl}</p>
                <p>Webhook endpoint: /api/payments/myfatoorah/webhook</p>
                {testMyfatoorah.data.methods?.length ? (
                  <p>Available methods returned: {testMyfatoorah.data.methods.slice(0, 6).join(', ')}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
