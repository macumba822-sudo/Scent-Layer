import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WooPaymentsCardFields } from '../components/WooPaymentsCardFields.jsx';

const CART_TOKEN_KEY='dayoleWooCartToken';
const emptyAddress={first_name:'',last_name:'',email:'',phone:'',address_1:'',address_2:'',city:'',state:'TX',postcode:'',country:'US'};
const fieldStyle={width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d8d8d8',borderRadius:10,fontSize:16,background:'#fff'};
const labelStyle={display:'grid',gap:7,fontSize:13,fontWeight:600};

function money(amount,minorUnit=2,currency='USD'){
  const value=Number(amount||0)/(10**Number(minorUnit||0));
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value);}catch{return `$${value.toFixed(2)}`;}
}

export function CheckoutPage(){
  const [checkout,setCheckout]=useState(null);
  const [cart,setCart]=useState(null);
  const [address,setAddress]=useState(emptyAddress);
  const [gateways,setGateways]=useState([]);
  const [paymentMethod,setPaymentMethod]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [selectingRate,setSelectingRate]=useState('');
  const [placingOrder,setPlacingOrder]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const token=localStorage.getItem(CART_TOKEN_KEY);
    if(!token){setLoading(false);setError('Your DAYOLE cart could not be found.');return;}
    let cancelled=false;
    async function load(){
      setLoading(true);setError('');
      try{
        const [cartResponse,checkoutResponse,gatewayResponse]=await Promise.all([
          fetch('/api/woocommerce/cart',{headers:{Accept:'application/json','Cart-Token':token}}),
          fetch('/api/woocommerce/checkout',{headers:{Accept:'application/json','Cart-Token':token}}),
          fetch('/api/woocommerce/payment-gateways',{headers:{Accept:'application/json'}})
        ]);
        const cartBody=await cartResponse.json().catch(()=>({}));
        const checkoutBody=await checkoutResponse.json().catch(()=>({}));
        const gatewayBody=await gatewayResponse.json().catch(()=>[]);
        if(!cartResponse.ok)throw new Error(cartBody?.message||cartBody?.error||`Unable to load cart (${cartResponse.status})`);
        if(!checkoutResponse.ok)throw new Error(checkoutBody?.message||checkoutBody?.error||`Unable to load checkout (${checkoutResponse.status})`);
        if(!cancelled){
          setCart(cartBody);setCheckout(checkoutBody);
          const available=Array.isArray(gatewayBody)?gatewayBody:[];
          setGateways(available);
          setPaymentMethod(current=>current||available[0]?.id||'');
          const existing=checkoutBody?.billing_address||checkoutBody?.shipping_address||{};
          setAddress(prev=>({...prev,...Object.fromEntries(Object.entries(existing).filter(([,v])=>v!=null))}));
          sessionStorage.setItem('dayoleWooCheckout',JSON.stringify(checkoutBody));
        }
      }catch(err){if(!cancelled)setError(err?.message||'Unable to load checkout');}
      finally{if(!cancelled)setLoading(false);}
    }
    load();return()=>{cancelled=true;};
  },[]);

  const setField=(name,value)=>{setSaved(false);setAddress(a=>({...a,[name]:value}));};

  async function saveShipping(event){
    event.preventDefault();const token=localStorage.getItem(CART_TOKEN_KEY);if(!token)return;
    setSaving(true);setError('');setSaved(false);
    try{
      const billing={...address};const shipping={...address};delete shipping.email;
      const response=await fetch('/api/woocommerce/cart/customer',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':token},body:JSON.stringify({billing_address:billing,shipping_address:shipping})});
      const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.message||body?.error||`Unable to save shipping (${response.status})`);
      setCart(body);setSaved(true);
    }catch(err){setError(err?.message||'Unable to save shipping information');}finally{setSaving(false);}
  }

  async function chooseShippingRate(packageId,rateId){
    const token=localStorage.getItem(CART_TOKEN_KEY);if(!token)return;
    setSelectingRate(`${packageId}:${rateId}`);setError('');
    try{
      const response=await fetch('/api/woocommerce/cart/shipping-rate',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':token},body:JSON.stringify({package_id:packageId,rate_id:rateId})});
      const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.message||body?.error||`Unable to select shipping (${response.status})`);setCart(body);
    }catch(err){setError(err?.message||'Unable to select shipping method');}finally{setSelectingRate('');}
  }

  async function placePayPalOrder(){
    const token=localStorage.getItem(CART_TOKEN_KEY);if(!token)return;
    setPlacingOrder(true);setError('');
    try{
      const billing={...address};const shipping={...address};delete shipping.email;
      const response=await fetch('/api/woocommerce/checkout',{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':token},
        body:JSON.stringify({
          billing_address:billing,
          shipping_address:shipping,
          payment_method:'ppcp-gateway',
          payment_data:[],
          expected_total:String(total)
        })
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.message||body?.error||body?.details?.message||`PayPal checkout failed (${response.status})`);
      sessionStorage.setItem('dayoleWooCheckout',JSON.stringify(body));
      const redirect=body?.payment_result?.redirect_url||body?.payment_result?.redirect||body?.redirect_url||body?.redirect;
      if(!redirect)throw new Error('PayPal did not return a checkout redirect.');
      window.location.assign(redirect);
    }catch(err){setError(err?.message||'Unable to continue to PayPal');setPlacingOrder(false);}
  }

  const items=Array.isArray(cart?.items)?cart.items:[];
  const totals=cart?.totals||{};
  const minorUnit=totals.currency_minor_unit??items[0]?.prices?.currency_minor_unit??2;
  const currency=totals.currency_code||items[0]?.prices?.currency_code||'USD';
  const total=totals.total_price??totals.total_items??0;
  const shippingTotal=totals.total_shipping??0;
  const taxTotal=totals.total_tax??0;
  const shippingPackages=Array.isArray(cart?.shipping_rates)?cart.shipping_rates:[];
  const itemCount=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.quantity||0),0),[items]);

  if(loading)return <main style={{padding:40}}>Loading your checkout…</main>;
  if(error&&!cart)return <main style={{padding:40}}><h2>We couldn't load your checkout.</h2><p>{error}</p><Link to="/store">Return to DAYOLE Store</Link></main>;
  if(items.length===0)return <main style={{padding:40}}><h2>Your cart is empty.</h2><Link to="/store">Return to DAYOLE Store</Link></main>;

  return <main style={{minHeight:'70vh',background:'#f7f7f5',padding:'56px 20px 90px'}}><div style={{width:'min(1120px,100%)',margin:'0 auto'}}>
    <div style={{marginBottom:32}}><p style={{fontSize:12,letterSpacing:'.22em',textTransform:'uppercase',color:'#4f7cff',marginBottom:10}}>DAYOLE Checkout</p><h1 style={{fontSize:'clamp(34px,5vw,58px)',lineHeight:1,margin:0}}>Secure checkout</h1><p style={{marginTop:14,color:'#666'}}>Products, shipping and payment options are synchronized with WooCommerce.</p></div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(300px,.8fr)',gap:24,alignItems:'start'}}>
      <section style={{background:'#fff',borderRadius:20,padding:28}}><h2 style={{marginTop:0}}>Contact & shipping</h2>
        <form onSubmit={saveShipping} style={{display:'grid',gap:16}}>
          <label style={labelStyle}>Email<input required type="email" value={address.email} onChange={e=>setField('email',e.target.value)} style={fieldStyle}/></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label style={labelStyle}>First name<input required value={address.first_name} onChange={e=>setField('first_name',e.target.value)} style={fieldStyle}/></label><label style={labelStyle}>Last name<input required value={address.last_name} onChange={e=>setField('last_name',e.target.value)} style={fieldStyle}/></label></div>
          <label style={labelStyle}>Phone<input required type="tel" value={address.phone} onChange={e=>setField('phone',e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>Street address<input required value={address.address_1} onChange={e=>setField('address_1',e.target.value)} style={fieldStyle}/></label>
          <label style={labelStyle}>Apartment, suite, etc. (optional)<input value={address.address_2} onChange={e=>setField('address_2',e.target.value)} style={fieldStyle}/></label>
          <div style={{display:'grid',gridTemplateColumns:'1.3fr .7fr .8fr',gap:12}}><label style={labelStyle}>City<input required value={address.city} onChange={e=>setField('city',e.target.value)} style={fieldStyle}/></label><label style={labelStyle}>State<input required maxLength="2" value={address.state} onChange={e=>setField('state',e.target.value.toUpperCase())} style={fieldStyle}/></label><label style={labelStyle}>ZIP<input required value={address.postcode} onChange={e=>setField('postcode',e.target.value)} style={fieldStyle}/></label></div>
          {error&&<p style={{margin:0,color:'#b42318'}}>{error}</p>}{saved&&<p style={{margin:0,color:'#177245',fontWeight:600}}>Shipping information saved. Choose a delivery method below.</p>}
          <button type="submit" disabled={saving} style={{border:0,borderRadius:12,padding:'15px 18px',fontSize:16,fontWeight:700,background:'#111',color:'#fff',cursor:'pointer'}}>{saving?'Calculating…':'Continue to shipping'}</button>
        </form>

        {saved&&<><div style={{marginTop:26,borderTop:'1px solid #e8e8e8',paddingTop:24}}><h3 style={{margin:'0 0 14px'}}>Shipping method</h3>
          {shippingPackages.length===0?<p style={{color:'#777'}}>No shipping methods are available for this address.</p>:<div style={{display:'grid',gap:12}}>{shippingPackages.flatMap((pkg,pkgIndex)=>{const packageId=pkg.package_id??pkgIndex;return (pkg.shipping_rates||[]).map(rate=>{const id=rate.rate_id||rate.id;const selected=Boolean(rate.selected);return <label key={`${packageId}:${id}`} style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:12,alignItems:'center',padding:14,border:selected?'2px solid #111':'1px solid #ddd',borderRadius:12,cursor:'pointer'}}><input type="radio" name={`shipping-${packageId}`} checked={selected} disabled={Boolean(selectingRate)} onChange={()=>chooseShippingRate(packageId,id)}/><strong>{rate.name||rate.label||'Shipping'}</strong><strong>{Number(rate.price||0)===0?'Free':money(rate.price,rate.currency_minor_unit??minorUnit,rate.currency_code||currency)}</strong></label>;});})}</div>}
        </div>

        <div style={{marginTop:26,borderTop:'1px solid #e8e8e8',paddingTop:24}}><h3 style={{margin:'0 0 6px'}}>Payment</h3><p style={{margin:'0 0 16px',color:'#777',fontSize:14}}>Payment methods are provided by WooCommerce.</p>
          {gateways.length===0?<p style={{padding:14,border:'1px solid #ddd',borderRadius:12}}>No payment methods are currently available.</p>:<div style={{display:'grid',gap:12}}>{gateways.map(gateway=><div key={gateway.id}><label style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:12,alignItems:'start',padding:16,border:paymentMethod===gateway.id?'2px solid #111':'1px solid #ddd',borderRadius:12,cursor:'pointer'}}><input type="radio" name="payment-method" value={gateway.id} checked={paymentMethod===gateway.id} onChange={()=>setPaymentMethod(gateway.id)}/><span><strong style={{display:'block'}}>{gateway.title||gateway.method_title||gateway.id}</strong>{gateway.description?<span style={{display:'block',marginTop:5,color:'#777',fontSize:13}}>{gateway.description.replace(/<[^>]*>/g,'')}</span>:null}</span></label>{paymentMethod===gateway.id&&gateway.id==='woocommerce_payments'?<WooPaymentsCardFields/>:null}{paymentMethod===gateway.id&&gateway.id==='ppcp-gateway'?<div style={{padding:'14px 0 2px'}}><button type="button" onClick={placePayPalOrder} disabled={placingOrder} style={{width:'100%',border:0,borderRadius:12,padding:'15px 18px',fontSize:16,fontWeight:700,background:'#ffc439',color:'#111',cursor:placingOrder?'wait':'pointer'}}>{placingOrder?'Opening PayPal…':'Continue with PayPal'}</button></div>:null}</div>)}</div>}
          {paymentMethod&&<p style={{margin:'14px 0 0',fontSize:13,color:'#666'}}>Selected: {gateways.find(g=>g.id===paymentMethod)?.title||paymentMethod}</p>}
        </div></>}
      </section>

      <aside style={{background:'#fff',borderRadius:20,padding:28}}><div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'baseline',marginBottom:20}}><h2 style={{margin:0}}>Order summary</h2><span style={{color:'#666'}}>{itemCount} item{itemCount===1?'':'s'}</span></div>
        <div style={{display:'grid',gap:18}}>{items.map(item=>{const prices=item.prices||{};const iu=prices.currency_minor_unit??minorUnit;const ic=prices.currency_code||currency;const image=item.images?.[0];const variation=Array.isArray(item.variation)?item.variation.map(v=>v.value).filter(Boolean).join(' · '):'';const line=Number(prices.price||0)*Number(item.quantity||1);return <div key={item.key||item.id} style={{display:'grid',gridTemplateColumns:'64px 1fr auto',gap:12,alignItems:'center'}}><div style={{width:64,height:64,borderRadius:12,overflow:'hidden',background:'#f3f3f3'}}>{image?.src?<img src={image.src} alt={image.alt||item.name||'Product'} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:null}</div><div><strong style={{display:'block'}}>{item.name}</strong><span style={{color:'#777',fontSize:13}}>{variation||'DAYOLE'} · Qty {item.quantity}</span></div><strong>{money(line,iu,ic)}</strong></div>;})}</div>
        <div style={{borderTop:'1px solid #e8e8e8',marginTop:24,paddingTop:18,display:'grid',gap:10}}><div style={{display:'flex',justifyContent:'space-between'}}><span>Shipping</span><span>{money(shippingTotal,minorUnit,currency)}</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Tax</span><span>{money(taxTotal,minorUnit,currency)}</span></div><div style={{display:'flex',justifyContent:'space-between',fontSize:20,borderTop:'1px solid #eee',paddingTop:14}}><span>Total</span><strong>{money(total,minorUnit,currency)}</strong></div></div>
      </aside>
    </div>
  </div></main>;
}
