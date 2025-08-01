const Joi = require('joi');

const paymentRequestSchema = Joi.object({
  amount: Joi.number().positive().precision(6).required(),
  orderId: Joi.string().alphanum().min(1).max(100).required(),
  network: Joi.string().valid(
    'ethereum', 'optimism', 'arbitrum', 'avalanche', 'base', 'bsc',
    'sepolia', 'optimism-sepolia', 'arbitrum-sepolia', 'fuji', 'base-sepolia', 'bsc-testnet'
  ).default('ethereum'),
  token: Joi.string().valid('usdt', 'usdc').default('usdt'),
  metadata: Joi.object().optional()
});

const verificationRequestSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required()
});

const webhookPaymentSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  confirmations: Joi.number().integer().min(0).required()
});

const webhookTransactionSchema = Joi.object({
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  toAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().positive().required(),
  token: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

function validatePaymentRequest(data) {
  return paymentRequestSchema.validate(data);
}

function validateVerificationRequest(data) {
  return verificationRequestSchema.validate(data);
}

function validateWebhookPayment(data) {
  return webhookPaymentSchema.validate(data);
}

function validateWebhookTransaction(data) {
  return webhookTransactionSchema.validate(data);
}

module.exports = {
  validatePaymentRequest,
  validateVerificationRequest,
  validateWebhookPayment,
  validateWebhookTransaction
};