const baseUrl = process.env.WOOCOMMERCE_URL;
const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

function wooAuth() {
  return Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
}

export async function testWooCommerceConnection() {
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WooCommerce environment variables are not configured');
  const url = new URL('/wp-json/wc/v3/system_status', baseUrl);
  const response = await fetch(url, { method:'GET', headers:{ Authorization:`Basic ${wooAuth()}`, Accept:'application/json' } });
  if (!response.ok) { const body=await response.text(); throw new Error(`WooCommerce connection failed (${response.status}): ${body.slice(0,300)}`); }
  const data=await response.json(); return { connected:true, environment:data.environment??null, settings:data.settings??null };
}

export async function getWooCommerceProducts() {
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WooCommerce environment variables are not configured');
  const url=new URL('/wp-json/wc/v3/products?per_page=100',baseUrl);
  const response=await fetch(url,{method:'GET',headers:{Authorization:`Basic ${wooAuth()}`,Accept:'application/json'}});
  if(!response.ok){const body=await response.text();throw new Error(`WooCommerce products failed (${response.status}): ${body.slice(0,300)}`);} return response.json();
}

export async function getWooCommerceProductVariations(productId) {
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WooCommerce environment variables are not configured');
  const url=new URL(`/wp-json/wc/v3/products/${productId}/variations?per_page=100`,baseUrl);
  const response=await fetch(url,{method:'GET',headers:{Authorization:`Basic ${wooAuth()}`,Accept:'application/json'}});
  if(!response.ok){const body=await response.text();throw new Error(`WooCommerce variations failed (${response.status}): ${body.slice(0,300)}`);} return response.json();
}

export async function addWooCommerceCartItem({ productId, variationId, quantity=1, cartToken }) {
  if(!baseUrl) throw new Error('WooCommerce URL is not configured'); let activeCartToken=cartToken||null;
  if(!activeCartToken){const cartUrl=new URL('/wp-json/wc/store/v1/cart',baseUrl);const cartResponse=await fetch(cartUrl,{method:'GET',headers:{Accept:'application/json'}});const cartBody=await cartResponse.text();if(!cartResponse.ok)throw new Error(`WooCommerce cart initialization failed (${cartResponse.status}): ${cartBody.slice(0,500)}`);activeCartToken=cartResponse.headers.get('Cart-Token');if(!activeCartToken)throw new Error('WooCommerce did not return a Cart-Token');}
  const url=new URL('/wp-json/wc/store/v1/cart/add-item',baseUrl);const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':activeCartToken},body:JSON.stringify({id:Number(variationId||productId),quantity:Number(quantity)})});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce cart failed (${response.status}): ${body.slice(0,500)}`);return {cart:JSON.parse(body),cartToken:response.headers.get('Cart-Token')||activeCartToken};
}

export async function getWooCommerceCart(cartToken){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');const response=await fetch(new URL('/wp-json/wc/store/v1/cart',baseUrl),{method:'GET',headers:{Accept:'application/json','Cart-Token':cartToken}});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce get cart failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}

export async function updateWooCommerceCartItem(cartToken,key,quantity){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');const response=await fetch(new URL('/wp-json/wc/store/v1/cart/update-item',baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':cartToken},body:JSON.stringify({key,quantity:Number(quantity)})});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce update cart failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}

export async function removeWooCommerceCartItem(cartToken,key){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');const response=await fetch(new URL('/wp-json/wc/store/v1/cart/remove-item',baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':cartToken},body:JSON.stringify({key})});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce remove cart item failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}

export async function updateWooCommerceCustomer(cartToken,{billingAddress,shippingAddress}){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');if(!billingAddress||!shippingAddress)throw new Error('Billing and shipping addresses are required');const response=await fetch(new URL('/wp-json/wc/store/v1/cart/update-customer',baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':cartToken},body:JSON.stringify({billing_address:billingAddress,shipping_address:shippingAddress})});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce update customer failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}

export async function selectWooCommerceShippingRate(cartToken,packageId,rateId){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');if(packageId===undefined||packageId===null||!rateId)throw new Error('Package ID and shipping rate ID are required');const response=await fetch(new URL('/wp-json/wc/store/v1/cart/select-shipping-rate',baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':cartToken},body:JSON.stringify({package_id:Number(packageId),rate_id:rateId})});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce select shipping rate failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}

export async function getWooCommercePaymentGateways(){if(!baseUrl||!consumerKey||!consumerSecret)throw new Error('WooCommerce environment variables are not configured');const response=await fetch(new URL('/wp-json/wc/v3/payment_gateways',baseUrl),{method:'GET',headers:{Authorization:`Basic ${wooAuth()}`,Accept:'application/json'}});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce payment gateways failed (${response.status}): ${body.slice(0,500)}`);const gateways=JSON.parse(body);return gateways.filter(g=>g.enabled).map(g=>({id:g.id,title:g.title,description:g.description,method_title:g.method_title,supports:g.method_supports||[]}));}

export async function processWooCommerceCheckout(cartToken,{billingAddress,shippingAddress,paymentMethod,paymentData=[],customerNote='',expectedTotal}){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');if(!billingAddress||!shippingAddress||!paymentMethod)throw new Error('Billing address, shipping address and payment method are required');const payload={billing_address:billingAddress,shipping_address:shippingAddress,payment_method:paymentMethod,payment_data:Array.isArray(paymentData)?paymentData:[],customer_note:customerNote};if(expectedTotal!==undefined&&expectedTotal!==null)payload.expected_total=String(expectedTotal);const response=await fetch(new URL('/wp-json/wc/store/v1/checkout',baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Cart-Token':cartToken},body:JSON.stringify(payload)});const body=await response.text();let data={};try{data=JSON.parse(body);}catch{data={message:body};}if(!response.ok){const error=new Error(data?.message||`WooCommerce checkout processing failed (${response.status})`);error.status=response.status;error.data=data;throw error;}return data;}

export async function getWooCommerceCheckout(cartToken){if(!baseUrl)throw new Error('WooCommerce URL is not configured');if(!cartToken)throw new Error('Cart-Token is required');const response=await fetch(new URL('/wp-json/wc/store/v1/checkout',baseUrl),{method:'GET',headers:{Accept:'application/json','Cart-Token':cartToken}});const body=await response.text();if(!response.ok)throw new Error(`WooCommerce checkout failed (${response.status}): ${body.slice(0,500)}`);return JSON.parse(body);}
