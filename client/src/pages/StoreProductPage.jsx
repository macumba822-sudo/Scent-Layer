import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Nav } from '../components/Nav.jsx';
import { Footer } from '../components/Footer.jsx';
import { BackToTop } from '../components/BackToTop.jsx';
import { useDocumentMeta } from '../lib/seo.js';

export function StoreProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentMeta({ title: product ? `${product.name} | DAYOLE Store` : 'DAYOLE Store | Scent Layer', description: product?.short_description?.replace(/<[^>]+>/g, '') || 'DAYOLE fragrance details.' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const productResponse = await fetch('/api/woocommerce/products');
        if (!productResponse.ok) throw new Error(`Store request failed (${productResponse.status})`);
        const products = await productResponse.json();
        const match = Array.isArray(products) ? products.find(item => String(item.id) === String(id)) : null;
        if (!match) throw new Error('Product not found.');
        if (!cancelled) setProduct(match);

        if (match.type === 'variable') {
          const variationResponse = await fetch(`/api/woocommerce/products/${id}/variations`);
          if (!variationResponse.ok) throw new Error(`Variation request failed (${variationResponse.status})`);
          const variationData = await variationResponse.json();
          const available = Array.isArray(variationData) ? variationData.filter(item => item.status === 'publish') : [];
          if (!cancelled) {
            setVariations(available);
            const firstPurchasable = available.find(item => item.purchasable && item.stock_status === 'instock');
            if (firstPurchasable) setSelectedVariationId(String(firstPurchasable.id));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load this product.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const category = product?.categories?.[0]?.name;
  const images = product?.images || [];
  const cleanDescription = useMemo(() => product?.description || '', [product]);
  const selectedVariation = variations.find(item => String(item.id) === selectedVariationId) || null;
  const displayedPrice = selectedVariation?.price || product?.price;
  const canPurchase = product?.type === 'variable'
    ? Boolean(selectedVariation?.purchasable && selectedVariation?.stock_status === 'instock')
    : Boolean(product?.purchasable && product?.stock_status === 'instock');

  const variationLabel = variation => {
    const values = (variation.attributes || []).map(attribute => attribute.option).filter(Boolean);
    return values.length ? values.join(' / ') : variation.name || `Option ${variation.id}`;
  };

  async function addToCart() {
    if (!product || !canPurchase || addingToCart) return;

    setAddingToCart(true);
    setCartMessage('');

    try {
      const cartToken = window.localStorage.getItem('dayoleWooCartToken');
      const response = await fetch('/api/woocommerce/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(cartToken ? { 'Cart-Token': cartToken } : {}),
        },
        body: JSON.stringify({
          productId: product.id,
          variationId: selectedVariation ? selectedVariation.id : null,
          quantity: Math.max(1, Number(quantity) || 1),
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || `Unable to add to cart (${response.status})`);
      }

      const newCartToken = response.headers.get('Cart-Token');
      if (newCartToken) window.localStorage.setItem('dayoleWooCartToken', newCartToken);

      const itemCount = Array.isArray(body?.items)
        ? body.items.reduce((total, item) => total + Number(item.quantity || 0), 0)
        : null;

      window.dispatchEvent(new CustomEvent('dayole-cart-updated', { detail: { cart: body, itemCount } }));
      setCartMessage(itemCount != null ? `Added to cart. ${itemCount} item${itemCount === 1 ? '' : 's'} in cart.` : 'Added to cart.');
    } catch (err) {
      setCartMessage(err.message || 'Unable to add this item to the cart.');
    } finally {
      setAddingToCart(false);
    }
  }

  return <>
    <Nav />
    <main className="dayole-detail">
      <Link to="/store" className="dayole-back">← Back to DAYOLE Store</Link>
      {loading && <p className="dayole-detail-status">Loading fragrance…</p>}
      {error && <p className="dayole-detail-status">{error}</p>}
      {product && <section className="dayole-detail-grid">
        <div className="dayole-detail-media">
          {images[0]?.src ? <img src={images[0].src} alt={images[0].alt || product.name} /> : <div className="dayole-detail-placeholder" />}
        </div>
        <div className="dayole-detail-copy">
          {category && <p className="dayole-detail-category">{category}</p>}
          <h1>{product.name}</h1>
          <p className="dayole-detail-price">{displayedPrice !== '' && displayedPrice != null ? `$${displayedPrice}` : product.type === 'variable' ? 'Select a size' : 'Price coming soon'}</p>
          {product.short_description && <div className="dayole-detail-short" dangerouslySetInnerHTML={{ __html: product.short_description }} />}

          {product.type === 'variable' && variations.length > 0 && <div className="dayole-variations">
            <label htmlFor="dayole-size">Size</label>
            <select id="dayole-size" value={selectedVariationId} onChange={event => { setSelectedVariationId(event.target.value); setCartMessage(''); }}>
              {variations.map(variation => <option key={variation.id} value={variation.id} disabled={!variation.purchasable || variation.stock_status !== 'instock'}>
                {variationLabel(variation)}{variation.price ? ` — $${variation.price}` : ''}{variation.stock_status !== 'instock' ? ' — Out of stock' : ''}
              </option>)}
            </select>
            {selectedVariation && <p className="dayole-stock">{selectedVariation.stock_status === 'instock' ? 'In stock' : 'Out of stock'}</p>}
          </div>}

          <div className="dayole-purchase">
            <label htmlFor="dayole-quantity">Quantity</label>
            <div className="dayole-purchase-row">
              <input id="dayole-quantity" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
              <button type="button" onClick={addToCart} disabled={!canPurchase || addingToCart}>
                {addingToCart ? 'Adding…' : canPurchase ? 'Add to Cart' : 'Unavailable'}
              </button>
            </div>
            {cartMessage && <p className="dayole-cart-message" aria-live="polite">{cartMessage}</p>}
          </div>

          {cleanDescription && <div className="dayole-detail-description" dangerouslySetInnerHTML={{ __html: cleanDescription }} />}
        </div>
      </section>}
    </main>
    <Footer /><BackToTop />
    <style>{`
      .dayole-detail{max-width:1320px;margin:0 auto;padding:46px 32px 96px}.dayole-back{display:inline-block;margin-bottom:34px;color:inherit;text-decoration:none;font-size:14px;opacity:.7}.dayole-detail-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:64px;align-items:start}.dayole-detail-media{background:#f6f4f1;border-radius:22px;overflow:hidden;aspect-ratio:1/1}.dayole-detail-media img{width:100%;height:100%;object-fit:cover;display:block}.dayole-detail-placeholder{width:100%;height:100%;background:linear-gradient(135deg,#f3eee8,#faf9f7)}.dayole-detail-category{font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin:8px 0 14px}.dayole-detail-copy h1{font-size:clamp(38px,5vw,68px);line-height:1;margin:0 0 24px;font-weight:500}.dayole-detail-price{font-size:20px;margin:0 0 28px}.dayole-detail-short,.dayole-detail-description{font-size:16px;line-height:1.65;opacity:.8}.dayole-detail-description{margin-top:24px}.dayole-variations{margin:30px 0 8px}.dayole-variations label,.dayole-purchase label{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;opacity:.7}.dayole-variations select{width:100%;max-width:420px;padding:14px 16px;border:1px solid rgba(127,127,127,.3);border-radius:10px;background:transparent;color:inherit;font:inherit}.dayole-stock{font-size:13px;margin:10px 0 0;opacity:.65}.dayole-purchase{margin:24px 0 8px}.dayole-purchase-row{display:flex;gap:12px;max-width:420px}.dayole-purchase input{width:88px;padding:14px 12px;border:1px solid rgba(127,127,127,.3);border-radius:10px;background:transparent;color:inherit;font:inherit}.dayole-purchase button{flex:1;padding:14px 20px;border:0;border-radius:10px;background:#111;color:#fff;font:inherit;font-weight:600;cursor:pointer}.dayole-purchase button:disabled{opacity:.45;cursor:not-allowed}.dayole-cart-message{font-size:13px;margin:10px 0 0}.dayole-detail-status{text-align:center;padding:80px 20px}@media(max-width:800px){.dayole-detail{padding:30px 18px 72px}.dayole-detail-grid{grid-template-columns:1fr;gap:32px}.dayole-detail-copy h1{font-size:40px}}
    `}</style>
  </>;
}
