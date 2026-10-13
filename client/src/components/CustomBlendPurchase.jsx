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
function readRecipe() {
  try {
    const raw = sessionStorage.getItem('dayoleCurrentBlendRecipe');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function CustomBlendPurchase() {
  const { pathname } = useLocation();
  const { user, saveBlend } = useApp();
  const [mount, setMount] = useState(null);
  const [variations, setVariations] = useState([]);
  const [size, setSize] = useState('30 ml');
  const [name, setName] = useState('');
  const [components, setComponents] = useState([]);
  const [recipe, setRecipe] = useState([]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [savedKey, setSavedKey] = useState('');

  useEffect(() => {
    if (pathname !== '/tools') return undefined;
    let activeHost = null;
    let hiddenSample = null;
    const sync = () => {
      const result = document.querySelector('.result-content');
      if (!result) { if (activeHost) setMount(null); activeHost = null; return; }
      const blendTitle = result.querySelector('.result-blend-name')?.textContent?.trim() || '';
      if (blendTitle) setName(current => current || blendTitle);
      const nextComponents = Array.from(document.querySelectorAll('.builder-panel .filled-name')).map(el => el.textContent?.trim()).filter(Boolean);
      setComponents(current => current.join('|') === nextComponents.join('|') ? current : nextComponents);
      const nextRecipe = readRecipe();
      setRecipe(current => JSON.stringify(current) === JSON.stringify(nextRecipe) ? current : nextRecipe);
      const sections = Array.from(result.querySelectorAll(':scope > .result-section'));
      const sampleSection = sections.find(section => (section.querySelector('.result-section-title')?.textContent?.trim().toLowerCase() || '') === 'sample the blend') || null;
      if (sampleSection && sampleSection !== hiddenSample) { if (hiddenSample) hiddenSample.style.display = ''; hiddenSample = sampleSection; hiddenSample.style.display = 'none'; }
      let host = result.querySelector('[data-dayole-custom-blend-purchase]');
      if (!host) { host = document.createElement('div'); host.dataset.dayoleCustomBlendPurchase = 'true'; host.className = 'result-section'; result.appendChild(host); }
      if (host !== activeHost) { activeHost = host; setMount(host); }
    };
    sync();
    const timer = window.setInterval(sync, 500);
    return () => { window.clearInterval(timer); if (hiddenSample) hiddenSample.style.display = ''; if (activeHost?.parentNode) activeHost.parentNode.removeChild(activeHost); setMount(null); };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/tools') return;
    fetch(`/api/woocommerce/products/${CUSTOM_PRODUCT_ID}/variations`, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load sizes')))
      .then(data => { const rows = Array.isArray(data) ? data : []; setVariations(rows); const first = SIZE_ORDER.find(s => rows.some(v => variationSize(v).toLowerCase() === s.toLowerCase())); if (first) setSize(first); })
      .catch(() => setMessage('No se pudieron cargar los tamaños del perfume personalizado.'));
  }, [pathname]);

  const options = useMemo(() => SIZE_ORDER.map(label => ({ label, variation: variations.find(v => variationSize(v).toLowerCase() === label.toLowerCase()) })).filter(x => x.variation), [variations]);
  const recipeTotal = recipe.reduce((sum, item) => sum + Number(item?.percentage || 0), 0);
  const recipeText = recipe.map(item => `${item.name} — ${item.percentage}%`).join(' + ');
  const recipeValid = recipe.length >= 2 && recipeTotal === 100 && recipe.every(item => Number(item?.percentage) >= 1 && Number(item?.percentage) <= 99);

  function changePercentage(index, value) {
    const digits = String(value).replace(/[^0-9]/g, '');
    const percentage = digits === '' ? 0 : Math.min(99, Math.max(0, Number(digits)));
    setRecipe(current => current.map((item, i) => i === index ? { ...item, percentage } : item));
    setMessage('');
  }

  async function addBlend() {
    const perfumeName = name.trim();
    const selected = options.find(x => x.label === size)?.variation;
    if (!perfumeName) { setMessage('Ponle un nombre a tu perfume.'); return; }
    if (!selected) { setMessage('Selecciona un tamaño disponible.'); return; }
    if (components.length < 2) { setMessage('Analiza nuevamente la mezcla antes de añadirla al carrito.'); return; }
    if (!recipeValid) { setMessage('Los porcentajes deben ser mayores que 0 y sumar exactamente 100%.'); return; }
    setAdding(true); setMessage('');
    try {
      const token = localStorage.getItem('dayoleWooCartToken');
      const reference = `AI-${Date.now().toString(36).toUpperCase()}`;
      const response = await fetch('/api/woocommerce/cart/add', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Accept:'application/json', ...(token ? { 'Cart-Token':token } : {}) },
        body: JSON.stringify({ productId:CUSTOM_PRODUCT_ID, variationId:selected.id, quantity:1, customBlend:{ name:perfumeName, size, components, recipe, reference } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'No se pudo añadir la mezcla al carrito.');
      const newToken = response.headers.get('Cart-Token');
      if (newToken) localStorage.setItem('dayoleWooCartToken', newToken);
      window.dispatchEvent(new CustomEvent('dayole-cart-updated', { detail:{ cart:data, itemCount:data?.items_count } }));
      const saveKey = `${perfumeName}|${size}|${recipeText}`;
      if (user && saveKey !== savedKey) {
        const fragrances = components.map((component,index) => ({ id:`custom-${index+1}`, name:component }));
        const saved = await saveBlend({ name:perfumeName, fragrances, result:{ blendName:perfumeName, size, components, recipe, wooProductId:CUSTOM_PRODUCT_ID, wooVariationId:selected.id, reference } });
        if (saved) setSavedKey(saveKey);
      }
      setMessage(user ? 'Añadido al carrito y guardado en My Blends.' : 'Añadido al carrito.');
    } catch (error) { setMessage(error.message || 'No se pudo añadir la mezcla al carrito.'); }
    finally { setAdding(false); }
  }

  if (!mount) return null;
  return createPortal(<>
    <p className="result-section-title">COMPRA ESTA MEZCLA</p>
    <p className="result-text" style={{marginBottom:14}}>La IA propone una fórmula inicial. Ajusta los porcentajes a tu gusto antes de comprar.</p>
    {recipe.length > 0 && <div style={{marginBottom:16}}>
      <p className="save-blend-row-label" style={{marginBottom:8}}>Porcentajes de la mezcla</p>
      <div style={{display:'grid',gap:8}}>
        {recipe.map((item,index)=><label key={`${item.name}-${index}`} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 92px',gap:10,alignItems:'center'}}>
          <span className="result-text" style={{margin:0}}>{item.name}</span>
          <span style={{display:'flex',alignItems:'center',gap:5}}><input className="save-blend-input" type="number" inputMode="numeric" min="1" max="99" step="1" value={item.percentage || ''} onChange={e=>changePercentage(index,e.target.value)} style={{width:'72px',textAlign:'center'}}/><strong>%</strong></span>
        </label>)}
      </div>
      <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><strong>TOTAL</strong><strong>{recipeTotal}% {recipeValid ? '✓' : ''}</strong></div>
      {!recipeValid && <p className="result-text" style={{marginTop:6}}>El total debe ser exactamente 100%.</p>}
    </div>}
    <div className="save-blend-form" style={{display:'grid',gap:12}}>
      <label style={{display:'grid',gap:6}}><span className="save-blend-row-label">Nombre de tu perfume</span><input className="save-blend-input" type="text" value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="Escribe el nombre de tu perfume" /></label>
      <label style={{display:'grid',gap:6}}><span className="save-blend-row-label">Tamaño</span><select className="save-blend-input" value={size} onChange={e=>setSize(e.target.value)}>{options.map(({label,variation})=><option key={variation.id} value={label}>{label} — {priceLabel(variation)}</option>)}</select></label>
      <button type="button" className="analyze-btn" onClick={addBlend} disabled={adding||!options.length||!name.trim()||!recipeValid}>{adding?'Añadiendo…':'AÑADIR ESTA MEZCLA AL CARRITO'}</button>
      {message&&<p className="result-text" style={{marginTop:2}}>{message}</p>}
    </div>
  </>,mount);
}
