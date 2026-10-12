const baseUrl = process.env.WOOCOMMERCE_URL;
const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

export async function testWooCommerceConnection() {
  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce environment variables are not configured');
  }

  const url = new URL('/wp-json/wc/v3/system_status', baseUrl);

  const auth = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `WooCommerce connection failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const data = await response.json();

  return {
    connected: true,
    environment: data.environment ?? null,
    settings: data.settings ?? null,
  };
}
export async function getWooCommerceProducts() {
  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce environment variables are not configured');
  }

  const url = new URL('/wp-json/wc/v3/products?per_page=100', baseUrl);

  const auth = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `WooCommerce products failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  return response.json();
}
export async function getWooCommerceProductVariations(productId) {
  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce environment variables are not configured');
  }

  const url = new URL(
    `/wp-json/wc/v3/products/${productId}/variations?per_page=100`,
    baseUrl
  );

  const auth = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `WooCommerce variations failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  return response.json();
}

export async function addWooCommerceCartItem({
  productId,
  variationId,
  quantity = 1,
  cartToken
}) {
  if (!baseUrl) {
    throw new Error('WooCommerce URL is not configured');
  }

  let activeCartToken = cartToken || null;

  // If this is a new cart, initialize it first and obtain a Cart-Token.
  if (!activeCartToken) {
    const cartUrl = new URL('/wp-json/wc/store/v1/cart', baseUrl);

    const cartResponse = await fetch(cartUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const cartBody = await cartResponse.text();

    if (!cartResponse.ok) {
      throw new Error(
        `WooCommerce cart initialization failed (${cartResponse.status}): ${cartBody.slice(0, 500)}`
      );
    }

    activeCartToken = cartResponse.headers.get('Cart-Token');

    if (!activeCartToken) {
      throw new Error('WooCommerce did not return a Cart-Token');
    }
  }

  const itemId = variationId || productId;
  const url = new URL('/wp-json/wc/store/v1/cart/add-item', baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cart-Token': activeCartToken,
    },
    body: JSON.stringify({
      id: Number(itemId),
      quantity: Number(quantity),
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `WooCommerce cart failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  const data = JSON.parse(body);
  const newCartToken =
    response.headers.get('Cart-Token') || activeCartToken;

  return {
    cart: data,
    cartToken: newCartToken,
  };
}

export async function getWooCommerceCart(cartToken) {
  if (!baseUrl) {
    throw new Error('WooCommerce URL is not configured');
  }

  if (!cartToken) {
    throw new Error('Cart-Token is required');
  }

  const url = new URL('/wp-json/wc/store/v1/cart', baseUrl);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cart-Token': cartToken,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `WooCommerce get cart failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return JSON.parse(body);
}

export async function updateWooCommerceCartItem(cartToken, key, quantity) {
  if (!baseUrl) {
    throw new Error('WooCommerce URL is not configured');
  }

  if (!cartToken) {
    throw new Error('Cart-Token is required');
  }

  const url = new URL('/wp-json/wc/store/v1/cart/update-item', baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cart-Token': cartToken,
    },
    body: JSON.stringify({
      key,
      quantity: Number(quantity),
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `WooCommerce update cart failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return JSON.parse(body);
}

export async function removeWooCommerceCartItem(cartToken, key) {
  if (!baseUrl) {
    throw new Error('WooCommerce URL is not configured');
  }

  if (!cartToken) {
    throw new Error('Cart-Token is required');
  }

  const url = new URL('/wp-json/wc/store/v1/cart/remove-item', baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cart-Token': cartToken,
    },
    body: JSON.stringify({
      key,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `WooCommerce remove cart item failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return JSON.parse(body);
}

export async function getWooCommerceCheckout(cartToken) {
  if (!baseUrl) {
    throw new Error('WooCommerce URL is not configured');
  }

  if (!cartToken) {
    throw new Error('Cart-Token is required');
  }

  const url = new URL('/wp-json/wc/store/v1/checkout', baseUrl);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cart-Token': cartToken,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `WooCommerce checkout failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return JSON.parse(body);
}