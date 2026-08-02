/**
 * CheckoutCallback — Payment gateway return page
 *
 * Handles the redirect from MyFatoorah / Tap after payment.
 * URL params: ?orderId=123 (and optionally &error=1 for failed payments)
 *
 * Flow:
 *  1. Read orderId from query string
 *  2. Call payment.verify mutation to confirm payment status with gateway
 *  3. On success → clear cart → redirect to /order-confirmation
 *  4. On failure → show error with retry option
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { trpc } from '@/lib/trpc';

export default function CheckoutCallback() {
  const [, navigate] = useLocation();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'error'>('verifying');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const hasRun = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  const isError = params.get('error') === '1';

  const verifyMutation = trpc.payment.verify.useMutation({
    onSuccess: (data) => {
      if (data.status === 'paid') {
        clearCart();
        setStatus('success');
        // Navigate to confirmation after brief delay
        setTimeout(() => {
          navigate(`/order-confirmation?order=${orderNumber || orderId}`);
        }, 1500);
      } else if (data.status === 'failed') {
        setStatus('failed');
      } else {
        // Pending — treat as success for now, order is placed
        clearCart();
        setStatus('success');
        setTimeout(() => {
          navigate(`/order-confirmation?order=${orderNumber || orderId}`);
        }, 1500);
      }
    },
    onError: () => {
      setStatus('error');
    },
  });

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!orderId) {
      setStatus('error');
      return;
    }

    if (isError) {
      setStatus('failed');
      return;
    }

    verifyMutation.mutate({ orderId: parseInt(orderId, 10) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center py-24">
        <div className="text-center max-w-md px-6">
          {status === 'verifying' && (
            <>
              <Loader2
                size={48}
                className="animate-spin mx-auto mb-6"
                style={{ color: '#9D7D39' }}
              />
              <h1
                className="text-3xl font-light mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
              >
                Verifying Payment
              </h1>
              <p
                className="text-sm"
                style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
              >
                Please wait while we confirm your payment...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle
                size={48}
                className="mx-auto mb-6"
                style={{ color: '#9D7D39' }}
              />
              <h1
                className="text-3xl font-light mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
              >
                Payment Confirmed
              </h1>
              <p
                className="text-sm"
                style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
              >
                Redirecting to your order confirmation...
              </p>
            </>
          )}

          {(status === 'failed' || status === 'error') && (
            <>
              <XCircle
                size={48}
                className="mx-auto mb-6"
                style={{ color: '#C0392B' }}
              />
              <h1
                className="text-3xl font-light mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
              >
                {status === 'failed' ? 'Payment Failed' : 'Something Went Wrong'}
              </h1>
              <p
                className="text-sm mb-8"
                style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
              >
                {status === 'failed'
                  ? 'Your payment was not completed. Your order has been saved — you can try again.'
                  : 'We could not verify your payment. Please contact us if you were charged.'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate('/checkout')}
                  className="btn-obsidian"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="btn-gold-outline"
                >
                  Back to Home
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
