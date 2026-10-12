import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CartDrawer as LegacyCartDrawer } from './CartDrawer.jsx';

const CART_TOKEN_KEY = 'dayoleWooCartToken';

function money(amount, minorUnit = 2, currency = 'USD') {
  const value = Number(amount || 0) / (10 ** Number(minorUnit || 0));
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function UnifiedCartDrawer() {
  const { cartOpen, closeCart } = useApp();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasWooToken, setHasWooToken] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem(CART_TOKEN_KEY));
  });

  const loadCart = useCallback(async () => {
    const token = localStorage.getItem(CART_TOKEN_KEY);
    setHasWooToken(Boolean(token));
    if (!token) {
      setCart(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/woocommerce/cart', {
        headers: {
          Accept: 'application/json',
          'Cart-Token': token,
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || body?.error || `Unable to load cart (${response.status})`);
      }
      setCart(body);
    } catch (err) {
      setError(err?.message || 'Unable to load cart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cartOpen) loadCart();
  }, [cartOpen, loadCart]);

  useEffect(() => {
    const onUpdated = () => loadCart();
    window.addEventListener('dayole-cart-updated', onUpdated);
    return () => window.removeEventListener('dayole-cart-updated', onUpdated);
  }, [loadCart]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event) => {
      if (event.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cartOpen, closeCart]);

  const items = Array.isArray(cart?.items) ? cart.items : [];
  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  if (!hasWooToken) {
    return <LegacyCartDrawer />;
  }

  const totals = cart?.totals || {};
  const minorUnit = totals.currency_minor_unit ?? items[0]?.prices?.currency_minor_unit ?? 2;
  const currency = totals.currency_code || items[0]?.prices?.currency_code || 'USD';
  const subtotal = totals.total_items ?? totals.total_price ?? 0;

  return (
    <>
      <div className={`cart-scrim ${cartOpen ? 'open' : ''}`} onClick={closeCart} aria-hidden={!cartOpen} />
      <aside
        className={`cart-drawer ${cartOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Cart"
        aria-hidden={!cartOpen}
      >
        <header className="cart-head">
          <p className="cart-eyebrow">Your Cart</p>
          <h2 className="cart-title">
            {loading ? 'Loading…' : totalUnits === 0 ? 'Empty' : `${totalUnits} item${totalUnits !== 1 ? 's' : ''}`}
          </h2>
          <button type="button" className="cart-close" onClick={closeCart} aria-label="Close">✕</button>
        </header>

        {error ? (
          <div className="cart-empty">
            <p className="cart-empty-text">Could not load your cart.</p>
            <p className="cart-empty-sub">{error}</p>
            <button type="button" className="cart-empty-cta" onClick={loadCart}>Try again</button>
          </div>
        ) : loading && !cart ? (
          <div className="cart-empty">
            <p className="cart-empty-text">Loading your cart…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <p className="cart-empty-icon">◇</p>
            <p className="cart-empty-text">Nothing in the cart yet.</p>
            <p className="cart-empty-sub">Browse the DAYOLE catalog and add your favorite fragrance.</p>
            <button type="button" className="cart-empty-cta" onClick={closeCart}>Continue browsing</button>
          </div>
        ) : (
          <>
            <ul className="cart-items">
              {items.map((item) => {
                const prices = item.prices || {};
                const itemMinorUnit = prices.currency_minor_unit ?? minorUnit;
                const itemCurrency = prices.currency_code || currency;
                const unitPrice = prices.price ?? 0;
                const linePrice = Number(unitPrice) * Number(item.quantity || 1);
                const image = item.images?.[0];
                const variation = Array.isArray(item.variation)
                  ? item.variation.map(v => v.value).filter(Boolean).join(' · ')
                  : '';

                return (
                  <li key={item.key || item.id} className="cart-item">
                    <div className="cart-item-thumb">
                      {image?.src ? (
                        <img src={image.src} alt={image.alt || item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div className="cart-item-main">
                      <div className="cart-item-top">
                        <div className="cart-item-info">
                          <p className="cart-item-name">{item.name}</p>
                          {variation && <p className="cart-item-size">{variation}</p>}
                        </div>
                      </div>
                      <div className="cart-item-bottom">
                        <div className="cart-qty">
                          <span aria-label={`Quantity ${item.quantity}`}>Qty {item.quantity}</span>
                        </div>
                        <span className="cart-item-price">{money(linePrice, itemMinorUnit, itemCurrency)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="cart-foot">
              <div className="cart-summary">
                <span>Subtotal</span>
                <span className="cart-summary-val">{money(subtotal, minorUnit, currency)}</span>
              </div>
              <p className="cart-foot-note">Shipping, taxes, coupons and payment will be calculated by WooCommerce at checkout.</p>
              <button type="button" className="cart-checkout-btn" disabled>
                Checkout coming next
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
