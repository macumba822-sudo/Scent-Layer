import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Nav } from '../components/Nav.jsx';
import { Footer } from '../components/Footer.jsx';
import { BackToTop } from '../components/BackToTop.jsx';
import { useDocumentMeta } from '../lib/seo.js';

export function StoreProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentMeta({ title: product ? `${product.name} | DAYOLE Store` : 'DAYOLE Store | Scent Layer', description: product?.short_description?.replace(/<[^>]+>/g, '') || 'DAYOLE fragrance details.' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/woocommerce/products');
        if (!response.ok) throw new Error(`Store request failed (${response.status})`);
        const products = await response.json();
        const match = Array.isArray(products) ? products.find(item => String(item.id) === String(id)) : null;
        if (!match) throw new Error('Product not found.');
        if (!cancelled) setProduct(match);
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
  const hasPrice = product?.price !== '' && product?.price != null;
  const cleanDescription = useMemo(() => product?.description || '', [product]);

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
          <p className="dayole-detail-price">{hasPrice ? `$${product.price}` : product.type === 'variable' ? 'Multiple sizes available' : 'Price coming soon'}</p>
          {product.short_description && <div className="dayole-detail-short" dangerouslySetInnerHTML={{ __html: product.short_description }} />}
          {cleanDescription && <div className="dayole-detail-description" dangerouslySetInnerHTML={{ __html: cleanDescription }} />}
          <p className="dayole-detail-note">Size and purchase options will appear here once the WooCommerce variations are connected.</p>
        </div>
      </section>}
    </main>
    <Footer /><BackToTop />
    <style>{`
      .dayole-detail{max-width:1320px;margin:0 auto;padding:46px 32px 96px}.dayole-back{display:inline-block;margin-bottom:34px;color:inherit;text-decoration:none;font-size:14px;opacity:.7}.dayole-detail-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:64px;align-items:start}.dayole-detail-media{background:#f6f4f1;border-radius:22px;overflow:hidden;aspect-ratio:1/1}.dayole-detail-media img{width:100%;height:100%;object-fit:cover;display:block}.dayole-detail-placeholder{width:100%;height:100%;background:linear-gradient(135deg,#f3eee8,#faf9f7)}.dayole-detail-category{font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin:8px 0 14px}.dayole-detail-copy h1{font-size:clamp(38px,5vw,68px);line-height:1;margin:0 0 24px;font-weight:500}.dayole-detail-price{font-size:20px;margin:0 0 28px}.dayole-detail-short,.dayole-detail-description{font-size:16px;line-height:1.65;opacity:.8}.dayole-detail-description{margin-top:24px}.dayole-detail-note{margin-top:32px;padding:18px 20px;border:1px solid rgba(127,127,127,.22);border-radius:14px;font-size:14px;opacity:.68}.dayole-detail-status{text-align:center;padding:80px 20px}@media(max-width:800px){.dayole-detail{padding:30px 18px 72px}.dayole-detail-grid{grid-template-columns:1fr;gap:32px}.dayole-detail-copy h1{font-size:40px}}
    `}</style>
  </>;
}
