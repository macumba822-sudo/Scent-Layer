import { useEffect, useRef, useState } from 'react';

const CONFIG_URL='https://admin.dayolefragrance.com/wp-json/dayole/v1/wcpay-config';
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
  const [status,setStatus]=useState('loading');
  const [message,setMessage]=useState('Loading secure card fields…');
  const [isLive,setIsLive]=useState(false);

  useEffect(()=>{
    let active=true;
    async function mount(){
      try{
        const configResponse=await fetch(CONFIG_URL,{headers:{Accept:'application/json'}});
        const config=await configResponse.json().catch(()=>({}));
        if(!configResponse.ok||!config?.publishableKey)throw new Error('WooPayments public configuration is unavailable.');
        if(!config?.card?.enabled)throw new Error('Card payments are not enabled in WooPayments.');
        setIsLive(config.testMode===false);
        const Stripe=await loadStripeJs();
        if(!active||!mountRef.current)return;
        const stripe=Stripe(config.publishableKey,{stripeAccount:config.accountId||undefined});
        const elements=stripe.elements({locale:config.locale||'auto'});
        const card=elements.create('card',{hidePostalCode:true,style:{base:{fontSize:'16px',color:'#111827','::placeholder':{color:'#9ca3af'}},invalid:{color:'#b42318'}}});
        card.mount(mountRef.current);cardRef.current=card;
        card.on('change',event=>{if(!active)return;setStatus(event.complete?'ready':'editing');setMessage(event.error?.message||'Your card information is encrypted by Stripe and is not sent to DAYOLE servers.');});
        setStatus('editing');setMessage('Your card information is encrypted by Stripe and is not sent to DAYOLE servers.');
      }catch(error){if(active){setStatus('error');setMessage(error?.message||'Unable to load secure card fields.');}}
    }
    mount();
    return()=>{active=false;try{cardRef.current?.destroy();}catch{}cardRef.current=null;};
  },[]);

  return <div style={{marginTop:12,padding:16,border:'1px solid #ddd',borderRadius:12,background:'#fafafa'}}>
    <div style={{fontWeight:700,marginBottom:10}}>Card details</div>
    <div ref={mountRef} style={{minHeight:22,padding:'13px 14px',background:'#fff',border:'1px solid #d8d8d8',borderRadius:10}}/>
    <p style={{margin:'10px 0 0',fontSize:12,color:status==='error'?'#b42318':'#666'}}>{message}</p>
    {isLive&&<p style={{margin:'8px 0 0',fontSize:12,fontWeight:700,color:'#9a6700'}}>WooPayments is currently in LIVE mode. Do not enter a test card or submit a test charge.</p>}
  </div>;
}
