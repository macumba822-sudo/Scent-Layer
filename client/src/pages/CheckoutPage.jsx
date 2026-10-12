import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const CART_TOKEN_KEY = 'dayoleWooCartToken';

function money(amount, minorUnit = 2, currency = 'USD') {
  const value = Number(amount || 0) / (10 ** Number(minorUnit || 0));
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function CheckoutPage() {
  const [checkout, setCheckout] = useState(null);
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem(CART_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      setError('Your DAYOLE cart could not be found.');
      return;
    }

    let cancelled = false;
    async function loadCheckout() {
      setLoading(true);
      setError('');
      try {
        const [cartResponse, checkoutResponse] = await Promise.all([
          fetch('/api/woocommerce/cart', {
            headers: {
              Accept: 'application/json',
              'Cart-Token': token,
            },
          }),
          fetch('/api/woocommerce/checkout', {
            headers: {
              Accept: 'application/json',
              'Cart-Token': token,
            },
          }),
        ]);

        const cartBody = await cartResponse.json().catch(() => ({}));
        const checkoutBody = await checkoutResponse.json().catch(() => ({}));

        if (!cartResponse.ok) {
          throw new Error(cartBody?.message || cartBody?.error || `Unable to load cart (${cartResponse.status})`);
        }
        if (!checkoutResponse.ok) {
          throw new Error(checkoutBody?.message || checkoutBody?.error || `Unable to load checkout (${checkoutResponse.status})`);
        }

        if (!cancelled) {
          setCart(cartBody);
          setCheckout(checkoutBody);
          sessionStorage.setItem('dayoleWooCheckout', JSON.stringify(checkoutBody));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load checkout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCheckout();
    return () => { cancelled = true; };
  }, []);

  const items = Array.isArray(cart?.items) ? cart.items : [];
  const totals = cart?.totals || {};
  const minorUnit = totals.currency_minor_unit ?? items[0]?.prices?.currency_minor_unit ?? 2;
  const currency = totals.currency_code || items[0]?.prices?.currency_code || 'USD';
  const total = totals.total_price ?? totals.total_items ?? 0;
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items]);

  return (
    <main style={{ minHeight: '70vh', background: '#f7f7f5', padding: '56px 20px 90px' }}>
      <div style={{ width: 'min(1120px, 100%)', margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#4f7cff', marginBottom: 10 }}>DAYOLE Checkout</p>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 58px)', lineHeight: 1, margin: 0 }}>Secure checkout</h1>
          <p style={{ marginTop: 14, color: '#666', maxWidth: 650 }}>Your cart is connected to WooCommerce. Shipping, taxes and payment will be handled from this checkout.</p>
        </div>

        {loading ? (
          <section style={{ background: '#fff', borderRadius: 20, padding: 32 }}>Loading your checkout…</section>
        ) : error ? (
          <section style={{ background: '#fff', borderRadius: 20, padding: 32 }}>
            <h2 style={{ marginTop: 0 }}>We couldn't load your checkout.</h2>
            <p>{error}</p>
            <Link to="/store">Return to DAYOLE Store</Link>
          </section>
        ) : items.length === 0 ? (
          <section style={{ background: '#fff', borderRadius: 20, padding: 32 }}>
            <h2 style={{ marginTop: 0 }}>Your cart is empty.</h2>
            <p>Add a DAYOLE fragrance before continuing to checkout.</p>
            <Link to="/store">Return to DAYOLE Store</Link>
          </section>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, .8fr)', gap: 24, alignItems: 'start' }}>
            <section style={{ background: '#fff', borderRadius: 20, padding: 28 }}>
              <h2 style={{ marginTop: 0 }}>Contact & shipping</h2>
              <p style={{ color: '#666', lineHeight: 1.6 }}>Checkout connection is active. The next step will add the customer contact, shipping address, shipping methods, taxes and payment fields here using WooCommerce.</p>
              <div style={{ marginTop: 24, padding: 18, borderRadius: 14, background: '#f7f7f5' }}>
                <strong>WooCommerce checkout connected</strong>
                <p style={{ marginBottom: 0, color: '#666' }}>Your active WooCommerce cart and checkout session are connected to this page.</p>
              </div>
            </section>

            <aside style={{ background: '#fff', borderRadius: 20, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Order summary</h2>
                <span style={{ color: '#666' }}>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                {items.map((item) => {
                  const prices = item.prices || {};
                  const itemMinorUnit = prices.currency_minor_unit ?? minorUnit;
                  const itemCurrency = prices.currency_code || currency;
                  const image = item.images?.[0];
                  const variation = Array.isArray(item.variation)
                    ? item.variation.map(v => v.value).filter(Boolean).join(' · ')
                    : '';
                  const line = Number(prices.price || 0) * Number(item.quantity || 1);
                  return (
                    <div key={item.key || item.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', background: '#f3f3f3' }}>
                        {image?.src ? <img src={image.src} alt={image.alt || item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div>
                        <strong style={{ display: 'block' }}>{item.name}</strong>
                        <span style={{ color: '#777', fontSize: 13 }}>{variation || 'DAYOLE'} · Qty {item.quantity}</span>
                      </div>
                      <strong>{money(line, itemMinorUnit, itemCurrency)}</strong>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid #e8e8e8', marginTop: 24, paddingTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                <span>Total</span>
                <strong>{money(total, minorUnit, currency)}</strong>
              </div>
              <p style={{ color: '#777', fontSize: 13, lineHeight: 1.5 }}>Final shipping and tax amounts will be calculated by WooCommerce as checkout information is completed.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
