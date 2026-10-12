import express from 'express';
import {
  testWooCommerceConnection,
  getWooCommerceProducts,
  getWooCommerceProductVariations,
  addWooCommerceCartItem,
  getWooCommerceCart,
  updateWooCommerceCartItem,
  removeWooCommerceCartItem,
  getWooCommerceCheckout
} from '../services/woocommerce.js';
const router = express.Router();

router.get('/test', async (_req, res, next) => {
  try {
    const result = await testWooCommerceConnection();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.get('/products', async (_req, res, next) => {
  try {
    const products = await getWooCommerceProducts();
    res.json(products);
  } catch (error) {
    next(error);
  }
});
router.get('/products/:id/variations', async (req, res, next) => {
  try {
    const variations = await getWooCommerceProductVariations(req.params.id);
    res.json(variations);
  } catch (error) {
    next(error);
  }
});
router.post('/cart/add', async (req, res, next) => {
  try {
    const result = await addWooCommerceCartItem({
      productId: req.body.productId,
      variationId: req.body.variationId,
      quantity: req.body.quantity || 1,
      cartToken: req.headers['cart-token'] || null,
    });

    if (result.cartToken) {
      res.setHeader('Cart-Token', result.cartToken);
    }

    res.json(result.cart);
  } catch (error) {
  console.error('WooCommerce cart error:', error);

  res.status(500).json({
    error: 'WooCommerce cart error',
    message: error.message
  });
}
});

router.get('/cart', async (req, res) => {
  try {
    const cartToken = req.headers['cart-token'];

    if (!cartToken) {
      return res.status(400).json({
        error: 'Cart-Token is required'
      });
    }

    const cart = await getWooCommerceCart(cartToken);
    res.json(cart);
  } catch (error) {
    console.error('WooCommerce get cart error:', error);

    res.status(500).json({
      error: 'WooCommerce get cart error',
      message: error.message
    });
  }
});

router.post('/cart/update', async (req, res) => {
  try {
    const cartToken = req.headers['cart-token'];

    if (!cartToken) {
      return res.status(400).json({
        error: 'Cart-Token is required'
      });
    }

    const cart = await updateWooCommerceCartItem(
      cartToken,
      req.body.key,
      req.body.quantity
    );

    res.json(cart);
  } catch (error) {
    console.error('WooCommerce update cart error:', error);

    res.status(500).json({
      error: 'WooCommerce update cart error',
      message: error.message
    });
  }
});

router.post('/cart/remove', async (req, res) => {
  try {
    const cartToken = req.headers['cart-token'];

    if (!cartToken) {
      return res.status(400).json({
        error: 'Cart-Token is required'
      });
    }

    const cart = await removeWooCommerceCartItem(
      cartToken,
      req.body.key
    );

    res.json(cart);
  } catch (error) {
    console.error('WooCommerce remove cart error:', error);

    res.status(500).json({
      error: 'WooCommerce remove cart error',
      message: error.message
    });
  }
});

router.get('/checkout', async (req, res) => {
  try {
    const cartToken = req.headers['cart-token'];

    if (!cartToken) {
      return res.status(400).json({
        error: 'Cart-Token is required'
      });
    }

    const checkout = await getWooCommerceCheckout(cartToken);

    res.json(checkout);
  } catch (error) {
    console.error('WooCommerce checkout error:', error);

    res.status(500).json({
      error: 'WooCommerce checkout error',
      message: error.message
    });
  }
});
export default router;

