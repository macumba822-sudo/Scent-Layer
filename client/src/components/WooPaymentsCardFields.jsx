import { useEffect, useRef, useState } from 'react';

const CONFIG_URL='https://admin.dayolefragrance.com/wp-json/dayole/v1/wcpay-config';
const CART_TOKEN_KEY='dayoleWooCartToken';
let stripeScriptPromise;

function loadStripeJs(){
  if(window.Stripe)return Promise.resolve(window.Stripe);
  if(stripeScriptPromise)return stripeScriptPromise;
  stripeScriptPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[src="https://js.stripe.com/v3/"]');
    if(existing){existing.addEventListener('load',()=>resolve(window.Stripe),{once:true});existing.addEventListener('error',()=>reject(new Error('Stripe.js could not be loaded.')),{once:true});return;}
    const script=document.createElement('script');script.src='https://js.stripe.com/v3/';script.async=true;
    script.onload=()=>resolve(window.Stripe);script.onerror=()=>reject(new Error('Stripe.js could not be loaded.'));document.head.appendChild(script);
  });
  return stripeScriptPromise;
}

export function WooPaymentsCardFields(){
  const mountRef=useRef(null);
  const cardRef=useRef(null);
  const stripeRef=useRef(null);
  const [status,setStatus]=useState('loading');
  const [message,setMessage]=useState('Loading secure card fields…');
  const [submitting,setSubmitting]=useState(false);
  const [orderResult,setOrderResult]=useState(null);

  useEffect(()=>{
    let active=true;
    async function mount(){
      try{
        const configResponse=await fetch(CONFIG_URL,{headers:{Accept:'application/json'}});
        const config=await configResponse.json().catch(()=>({}));
        if(!configResponse.ok||!config?.publishableKey)throw new Error('WooPayments public configuration is unavailable.');
        if(!config?.card?.enabled)throw new Error('Card payments are not enabled in WooPayments.');
        const Stripe=await loadStripeJs();
        if(!active||!mountRef.current)return;
        const stripe=Stripe(config.publishableKey,{stripeAccount:config.accountId||undefined});stripeRef.current=stripe;
        const elements=stripe.elements({locale:config.locale||'auto'});
        const card=elements.create('card',{hidePostalCode:true,style:{base:{fontSize:'16px',color:'#111827','::placeholder':{color:'#9ca3af'}},invalid:{color:'#b42318'}}});
        card.mount(mountRef.current);cardRef.current=card;
        card.on('change',event=>{if(!active)return;setStatus(event.complete?'ready':'editing');setMessage(event.error?.message||'Secure payment fields are ready.');});
        setStatus('editing');setMessage('Secure payment fields are ready.');
      }catch(error){if(active){setStatus('error');setMessage(error?.message||'Unable to load secure card fields.');}}
    }
    mount();
    return()=>{active=false;try{cardRef.current?.destroy();}catch{}cardRef.current=null;stripeRef.current=null;};
  },[]);

  async function placeOrder(){
    if(submitting)return;
    if(status!=='ready'){setMessage('Complete the card fields before placing the order.');return;}
    const token=localStorage.getItem(CART_TOKEN_KEY);
    if(!token){setMessage('Your DAYOLE cart could not be found.');return;}
    setSubmitting(true);setOrderResult(null);setMessage('Preparing your order…');
    try{
      const checkoutResponse=await fetch('/api/woocommerce/checkout',{headers:{Accept:'application/json','Cart-Token':token}});
      const checkout=await checkoutResponse.json().catch(()=>({}));
      if(!checkoutResponse.ok)throw new Error(checkout?.message||checkout?.error||'Unable to load checkout details.');
      const billing=checkout?.billing_address||{};
      const shipping=checkout?.shipping_address||{};
      const payment=await stripeRef.current.createPaymentMethod({
        type:'card',card:cardRef.current,
        billing_details:{
          name:[billing.first_name,billing.last_name].filter(Boolean).join(' '),
          email:billing.email||undefined,phone:billing.phone||undefined,
          address:{line1:billing.address_1||undefined,line2:billing.address_2||undefined,city:billing.city||undefined,state:billing.state||undefined,postal_code:billing.postcode||undefined,country:billing.country||'US'}
        }
      });
      if(payment.error)throw new Error(payment.error.message||'Payment details could not be prepared.');
      if(!payment.paymentMethod?.id)throw new Error('WooPayments did not return a payment method.');
      const response=await fetch('/api/woocommerce/checkout',{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':token},
        body:JSON.stringify({
          billing_address:billing,
          shipping_address:shipping,
          payment_method:'woocommerce_payments',
          payment_data:[
            {key:'payment_method',value:'card'},
            {key:'wcpay-payment-method',value:payment.paymentMethod.id}
          ]
        })
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.message||body?.error||'WooCommerce could not place the order.');
      setOrderResult(body);
      setMessage(body?.status?`Order received. Status: ${body.status}.`:'Order received by WooCommerce.');
      sessionStorage.setItem('dayoleWooOrder',JSON.stringify(body));
    }catch(error){setMessage(error?.message||'Unable to place the order.');}
    finally{setSubmitting(false);}
  }

  return <div style={{marginTop:12,padding:16,border:'1px solid #ddd',borderRadius:12,background:'#fafafa'}}>
    <div style={{fontWeight:700,marginBottom:10}}>Card details</div>
    <div ref={mountRef} style={{minHeight:22,padding:'13px 14px',background:'#fff',border:'1px solid #d8d8d8',borderRadius:10}}/>
    <p style={{margin:'10px 0 0',fontSize:12,color:status==='error'?'#b42318':orderResult?'#177245':'#666'}}>{message}</p>
    <button type="button" onClick={placeOrder} disabled={submitting||status==='error'||Boolean(orderResult)} style={{width:'100%',marginTop:14,border:0,borderRadius:12,padding:'15px 18px',fontSize:16,fontWeight:700,background:'#111',color:'#fff',cursor:submitting?'wait':'pointer',opacity:submitting||status==='error'?0.65:1}}>{submitting?'Placing order…':orderResult?'Order placed':'Place order'}</button>
  </div>;
}
