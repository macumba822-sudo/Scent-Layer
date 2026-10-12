import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const CUSTOM_PRODUCT_ID = 153;
const SIZE_ORDER = ['30 ml', '50 ml', '100 ml'];

function variationSize(variation) {
  const attr = (variation?.attributes || []).find(a => String(a?.name || '').toLowerCase() === 'size');
  return String(attr?.option || '').trim();
}

function priceLabel(variation) {
  const value = variation?.price || variation?.sale_price || variation?.regular_price;
  return value ? `$${Number(value).toFixed(2)}` : '';
}

export function CustomBlendPurchase() {
  const { pathname } = useLocation();
  const { user, saveBlend } = useApp();
  const [mount, setMount] = useState(null);
  const [variations, setVariations] = useState([]);
  const [size, setSize] = useState('30 ml');
  const [name, setName] = useState('');
  const [components, setComponents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [savedKey, setSavedKey] = useState('');

  useEffect(() => {
    if (pathname !== '/tools') return undefined;
    let host = null;
    let hiddenSample = null;

    const sync = () => {
      const result = document.querySelector('.result-content');
      if (!result) {
        setMount(null);
        return;
      }

      const blendTitle = result.querySelector('.result-blend-name')?.textContent?.trim() || '';
      if (blendTitle) setName(current => current || blendTitle);
      setComponents(Array.from(document.querySelectorAll('.builder-panel .filled-name')).map(el => el.textContent?.trim()).filter(Boolean));

      const sections = Array.from(result.querySelectorAll(':scope > .result-section'));
      hiddenSample = sections.find(section => section.querySelector('.result-section-title')?.textContent?.trim() === 'Sample The Blend') || null;
      if (hiddenSample) hiddenSample.style.display = 'none';

      host = result.querySelector('[data-dayole-custom-blend-purchase]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.dayoleCustomBlendPurchase = 'true';
        host.className = 'result-section';
        result.appendChild(host);
      }
      setMount(host);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (hiddenSample) hiddenSample.style.display = '';
      if (host?.parentNode) host.parentNode.removeChild(host);
      setMount(null);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/tools') return;
    fetch(`/api/woocommerce/products/${CUSTOM_PRODUCT_ID}/variations`, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load sizes')))
      .then(data => {
        const rows = Array.isArray(data) ? data : [];
        setVariations(rows);
        const first = SIZE_ORDER.find(s => rows.some(v => variationSize(v).toLowerCase() === s.toLowerCase()));
        if (first) setSize(first);
      })
      .catch(() => setMessage('Could not load custom perfume sizes.'));
  }, [pathname]);

  const options = useMemo(() => SIZE_ORDER.map(label => ({
    label,
    variation: variations.find(v => variationSize(v).toLowerCase() === label.toLowerCase()),
  })).filter(x => x.variation), [variations]);

  async function addBlend() {
    const perfumeName = name.trim();
    const selected = options.find(x => x.label === size)?.variation;
    if (!perfumeName) { setMessage('Name your perfume first.'); return; }
    if (!selected) { setMessage('Choose an available size.'); return; }
    if (components.length < 2) { setMessage('Analyze your blend again before adding it to the cart.'); return; }

    setAdding(true); setMessage('');
    try {
      const token = localStorage.getItem('dayoleWooCartToken');
      const reference = `AI-${Date.now().toString(36).toUpperCase()}`;
      const response = await fetch('/api/woocommerce/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { 'Cart-Token': token } : {}),
        },
        body: JSON.stringify({
          productId: CUSTOM_PRODUCT_ID,
          variationId: selected.id,
          quantity: 1,
          blendName: perfumeName,
          blendSize: size,
          blendComponents: components,
          blendReference: reference,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Could not add the blend to the cart');
      const newToken = response.headers.get('Cart-Token');
      if (newToken) localStorage.setItem('dayoleWooCartToken', newToken);
      window.dispatchEvent(new CustomEvent('dayole-cart-updated', { detail: { cart: data, itemCount: data?.items_count } }));

      const saveKey = `${perfumeName}|${size}|${components.join('|')}`;
      if (user && saveKey !== savedKey) {
        const fragrances = components.map((component, index) => ({ id: `custom-${index + 1}`, name: component }));
        const saved = await saveBlend({
          name: perfumeName,
          fragrances,
          result: { blendName: perfumeName, size, components, wooProductId: CUSTOM_PRODUCT_ID, wooVariationId: selected.id, reference },
        });
        if (saved) setSavedKey(saveKey);
      }
      setMessage(user ? 'Added to cart and saved to My Blends.' : 'Added to cart.');
    } catch (error) {
      setMessage(error.message || 'Could not add the blend to the cart.');
    } finally {
      setAdding(false);
    }
  }

  if (!mount) return null;
  return createPortal(
    <>
      <p className="result-section-title">Buy This Blend</p>
      <p className="result-text" style={{ marginBottom: 14 }}>Make this AI-created blend as your own DAYOLE custom perfume.</p>
      <div className="save-blend-form" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="save-blend-row-label">Nombre de tu perfume</span>
          <input className="save-blend-input" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Escribe el nombre de tu perfume" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="save-blend-row-label">Tamaño</span>
          <select className="save-blend-input" value={size} onChange={e => setSize(e.target.value)}>
            {options.map(({ label, variation }) => <option key={variation.id} value={label}>{label} — {priceLabel(variation)}</option>)}
          </select>
        </label>
        <button type="button" className="analyze-btn" onClick={addBlend} disabled={adding || !options.length || !name.trim()}>{adding ? 'Añadiendo…' : 'AÑADIR ESTA MEZCLA AL CARRITO'}</button>
        {message && <p className="result-text" style={{ marginTop: 2 }}>{message}</p>}
      </div>
    </>,
    mount,
  );
}
