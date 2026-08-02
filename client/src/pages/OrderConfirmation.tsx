/**
 * OrderConfirmation — Success page after order placement
 * Design: Obsidian Editorial
 */
import { Link } from 'wouter';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';

export default function OrderConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('order') || 'Pending';

  return (
    <Layout>
      <div className="container py-24 text-center max-w-2xl mx-auto">
        {/* Success icon */}
        <div
          className="w-20 h-20 flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: 'rgba(157,125,57,0.1)' }}
        >
          <CheckCircle size={40} style={{ color: '#9D7D39' }} />
        </div>

        <p
          className="text-xs font-semibold tracking-[0.25em] uppercase mb-4"
          style={{ color: '#9D7D39', fontFamily: 'Montserrat, sans-serif' }}
        >
          Order Confirmed
        </p>

        <h1
          className="text-5xl font-light mb-4"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#242424' }}
        >
          Thank You
        </h1>

        <p
          className="text-sm leading-relaxed mb-2"
          style={{ color: '#8A8A82', fontFamily: 'Montserrat, sans-serif' }}
        >
          Your order has been placed successfully.
        </p>

        <p
          className="text-lg font-medium italic mb-8"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#9D7D39' }}
        >
          Order #{orderNumber}
        </p>

        <div
          className="p-6 mb-10 text-left"
          style={{ backgroundColor: '#F0EDE8' }}
        >
          <h2
            className="text-xs font-semibold tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Montserrat, sans-serif', color: '#242424' }}
          >
            What Happens Next
          </h2>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Your order has been saved and you will receive a confirmation email shortly.' },
              { step: '2', text: 'If Direct Link payment is selected, our team will contact you with the payment link or collection instructions.' },
              { step: '3', text: 'After payment or arrangement is confirmed, we will prepare your order for pickup or delivery.' },
              { step: '4', text: 'You can track the order status using the order number shown above.' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <span
                  className="w-6 h-6 flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: '#9D7D39', color: '#FAFAF8', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {item.step}
                </span>
                <p
                  className="text-sm pt-0.5"
                  style={{ color: '#242424', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/track-order" className="btn-obsidian inline-block">
            Track Your Order
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 btn-gold-outline"
          >
            Continue Shopping <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
