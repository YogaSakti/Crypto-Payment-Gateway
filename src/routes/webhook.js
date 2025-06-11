const express = require('express');
const crypto = require('crypto');
const multiChainPaymentService = require('../services/multiChainPaymentService');

const router = express.Router();

function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

router.post('/payment-confirmed', verifyWebhookSignature, async (req, res) => {
  try {
    const { paymentId, txHash, confirmations } = req.body;
    
    const payment = multiChainPaymentService.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const networkConfig = multiChainPaymentService.getNetworkInfo(payment.networkKey);
    
    if (confirmations >= networkConfig.minConfirmations) {
      payment.status = 'confirmed';
      payment.confirmations = confirmations;
      payment.confirmedAt = new Date();
      
      console.log(`Payment ${paymentId} confirmed with ${confirmations} confirmations`);
      console.log(`Network: ${payment.network}, Token: ${payment.token}`);
      console.log(`Original amount: $${payment.originalAmount}, Paid: ${payment.amount} ${payment.token}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/transaction-notification', verifyWebhookSignature, async (req, res) => {
  try {
    const { txHash, toAddress, amount, token, network, chainId } = req.body;
    
    if (toAddress.toLowerCase() === process.env.WALLET_ADDRESS.toLowerCase()) {
      console.log(`New transaction received: ${txHash}`);
      console.log(`Network: ${network || 'Unknown'}, Token: ${token}, Amount: ${amount}`);
      
      // Try to find matching payment by amount
      // We need to determine which network this is from
      let matchingPayment = null;
      
      // If network is provided, search in that network
      if (network) {
        matchingPayment = multiChainPaymentService.findPaymentByAmount(amount, network, 'usdt');
        if (!matchingPayment) {
          matchingPayment = multiChainPaymentService.findPaymentByAmount(amount, network, 'usdc');
        }
      } else {
        // Search across all networks
        const supportedNetworks = multiChainPaymentService.getSupportedNetworks();
        for (const networkKey of supportedNetworks) {
          matchingPayment = multiChainPaymentService.findPaymentByAmount(amount, networkKey, 'usdt');
          if (matchingPayment) break;
          
          matchingPayment = multiChainPaymentService.findPaymentByAmount(amount, networkKey, 'usdc');
          if (matchingPayment) break;
        }
      }
      
      if (matchingPayment) {
        const { paymentId, payment } = matchingPayment;
        
        try {
          await multiChainPaymentService.verifyPayment(paymentId, txHash);
          console.log(`Auto-verified payment ${paymentId}`);
          console.log(`Network: ${payment.network}, Token: ${payment.token}`);
          console.log(`Original amount: $${payment.originalAmount}, Paid: ${payment.amount} ${payment.token}`);
        } catch (error) {
          console.error(`Auto-verification failed for ${paymentId}:`, error.message);
        }
      } else {
        console.log(`No matching pending payment found for amount: ${amount}`);
        
        console.log('Current pending payments:');
        for (const [id, payment] of multiChainPaymentService.pendingPayments) {
          if (payment.status === 'pending') {
            console.log(`- ID: ${id}, Amount: ${payment.amount} ${payment.token}, Network: ${payment.network}, Original: ${payment.originalAmount}`);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Transaction notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;