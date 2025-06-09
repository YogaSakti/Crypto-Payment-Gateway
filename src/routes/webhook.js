const express = require('express');
const crypto = require('crypto');
const paymentService = require('../services/paymentService');

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
    
    const payment = paymentService.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (confirmations >= process.env.MIN_CONFIRMATIONS) {
      payment.status = 'confirmed';
      payment.confirmations = confirmations;
      payment.confirmedAt = new Date();
      
      console.log(`Payment ${paymentId} confirmed with ${confirmations} confirmations`);
      console.log(`Original amount: $${payment.originalAmount}, Paid: $${payment.amount}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/transaction-notification', verifyWebhookSignature, async (req, res) => {
  try {
    const { txHash, toAddress, amount, token } = req.body;
    
    if (toAddress.toLowerCase() === process.env.WALLET_ADDRESS.toLowerCase() &&
        token.toLowerCase() === process.env.USDT_CONTRACT_ADDRESS.toLowerCase()) {
      
      console.log(`New USDT transaction received: ${txHash}, Amount: ${amount}`);
            
      const paymentMatch = paymentService.findPaymentByAmount(amount);
      
      if (paymentMatch) {
        const { paymentId, payment } = paymentMatch;
        
        try {
          await paymentService.verifyPayment(paymentId, txHash);
          console.log(`Auto-verified payment ${paymentId}`);
          console.log(`Original amount: $${payment.originalAmount}, Paid: $${payment.amount}`);
        } catch (error) {
          console.error(`Auto-verification failed for ${paymentId}:`, error.message);
        }
      } else {
        console.log(`No matching pending payment found for amount: ${amount}`);
        
        console.log('Current pending payments:');
        for (const [id, payment] of paymentService.pendingPayments) {
          if (payment.status === 'pending') {
            console.log(`- ID: ${id}, Amount: ${payment.amount}, Original: ${payment.originalAmount}`);
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