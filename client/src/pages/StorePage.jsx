import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav.jsx';
import { Footer } from '../components/Footer.jsx';
import { BackToTop } from '../components/BackToTop.jsx';
import { useDocumentMeta } from '../lib/seo.js';

export function StorePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentMeta({
    title: 'DAYOLE Store | Scent Layer',
    description: 'Shop DAYOLE fragrances, sizes, and collections.',
  });

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const response = await fetch('/api/woocommerce/products');
        if (!response.ok) throw new Error(`Store request failed (${response.status})`);
        const data = await response.json();
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load the DAYOLE catalog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Nav />
      <main className="dayole-store">
        <section className="dayole-store-hero">
          <p className="eyebrow">DAYOLE FRAGRANCE</p>
          <h1>DAYOLE Store</h1>
          <p>Discover our fragrance collection, directly connected to our live catalog.</p>
        </section>
        {loading && <p className="dayole-store-status">Loading fragrances…</p>}
        {error && <p className="dayole-store-status">{error}</p>}
        {!loading && !error && products.length === 0 && <p className="dayole-store-status">No products are available yet.</p>}
        <section className="dayole-product-grid" aria-live="polite">
          {products.map(product => {
            const image = product.images?.[0];
            const category = product.categories?.[0]?.name;
            const hasPrice = product.price !== '' && product.price != null;
            return (
              <Link className="dayole-product-card" key={product.id} to={`/store/${product.id}`} aria-label={`View ${product.name}`}>
                <div className="dayole-product-image-wrap">
                  {image?.src ? <img className="dayole-product-image" src={image.src} alt={image.alt || product.name} loading="lazy" /> : <div className="dayole-product-image dayole-product-placeholder" aria-hidden="true" />}
                </div>
                <div className="dayole-product-copy">
                  {category && <p className="dayole-product-category">{category}</p>}
                  <h2>{product.name}</h2>
                  <p className="dayole-product-price">{hasPrice ? `$${product.price}` : product.type === 'variable' ? 'Multiple sizes available' : 'Price coming soon'}</p>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
      <Footer />
      <BackToTop />
      <style>{`
        .dayole-store{max-width:1440px;margin:0 auto;padding:72px 32px 96px}.dayole-store-hero{max-width:760px;margin:0 auto 56px;text-align:center}.dayole-store-hero .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;opacity:.62}.dayole-store-hero h1{font-size:clamp(42px,7vw,82px);line-height:.95;margin:12px 0 20px}.dayole-store-hero>p:last-child{font-size:17px;line-height:1.6;opacity:.72}.dayole-store-status{text-align:center;padding:64px 16px;opacity:.7}.dayole-product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px 20px}.dayole-product-card{display:block;color:inherit;text-decoration:none;border:1px solid rgba(127,127,127,.2);border-radius:18px;overflow:hidden;background:var(--bg,#fff);transition:transform .18s ease,box-shadow .18s ease}.dayole-product-card:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,.08)}.dayole-product-image-wrap{aspect-ratio:1/1;background:#f6f4f1;overflow:hidden}.dayole-product-image{width:100%;height:100%;object-fit:cover;display:block}.dayole-product-placeholder{background:linear-gradient(135deg,#f3eee8,#faf9f7)}.dayole-product-copy{padding:18px 18px 22px}.dayole-product-category{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin:0 0 8px}.dayole-product-copy h2{font-size:18px;line-height:1.25;margin:0 0 12px;font-weight:500}.dayole-product-price{font-size:14px;margin:0;opacity:.75}@media(max-width:1050px){.dayole-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.dayole-store{padding:48px 18px 72px}.dayole-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 10px}.dayole-product-copy{padding:14px}.dayole-product-copy h2{font-size:15px}.dayole-store-hero{margin-bottom:36px}}@media(max-width:420px){.dayole-product-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </>
  );
}
