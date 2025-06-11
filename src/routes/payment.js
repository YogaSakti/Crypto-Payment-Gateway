const express = require('express');
const multiChainPaymentService = require('../services/multiChainPaymentService');
const { validatePaymentRequest, validateVerificationRequest } = require('../validators/paymentValidator');
const { authenticateAPI, rateLimitByAPIKey } = require('../middleware/auth');

const router = express.Router();

router.use(rateLimitByAPIKey());

router.post('/create', authenticateAPI('payment:create'), async (req, res) => {
  try {
    const { error } = validatePaymentRequest(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { amount, orderId, network = 'ethereum', token = 'usdt', metadata } = req.body;
    
    const enhancedMetadata = {
      ...metadata,
      apiKeyName: req.apiKey.name,
      requestedBy: req.apiKey.key.substring(0, 8) + '...',
      requestedAt: new Date().toISOString()
    };

    const payment = await multiChainPaymentService.createPayment(
      amount, 
      orderId, 
      network, 
      token, 
      enhancedMetadata
    );

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        originalAmount: payment.originalAmount,
        amount: payment.amount,
        walletAddress: payment.walletAddress,
        contractAddress: payment.contractAddress,
        network: payment.network,
        networkKey: payment.networkKey,
        chainId: payment.chainId,
        token: payment.token,
        tokenName: payment.tokenName,
        decimals: payment.decimals,
        blockExplorer: payment.blockExplorer,
        walletUrls: payment.walletUrls,
        qrCode: payment.qrCode,
        expiresAt: payment.expiresAt,
        note: `Please pay exactly ${payment.amount} ${payment.token} (${payment.originalAmount} + unique identifier)`,
        instructions: [
          `1. Send exactly ${payment.amount} ${payment.token} to the provided wallet address`,
          `2. Use ${payment.network} network (Chain ID: ${payment.chainId})`,
          `3. Token contract: ${payment.contractAddress}`,
          `4. Payment expires at ${payment.expiresAt}`,
          `5. You can use the provided wallet URLs for easy payment`
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/verify', authenticateAPI('payment:verify'), async (req, res) => {
  try {
    const { error } = validateVerificationRequest(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { paymentId, txHash } = req.body;
    
    console.log(`Payment verification requested by ${req.apiKey.name} for payment ${paymentId}`);
    
    const payment = await multiChainPaymentService.verifyPayment(paymentId, txHash);

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        originalAmount: payment.originalAmount,
        paidAmount: payment.amount,
        status: payment.status,
        txHash: payment.txHash,
        confirmations: payment.confirmations,
        verifiedAt: payment.verifiedAt,
        network: payment.network,
        token: payment.token,
        blockExplorer: `${payment.blockExplorer}/tx/${payment.txHash}`,
        message: payment.status === 'confirmed' 
          ? 'Payment confirmed successfully' 
          : `Payment verified but waiting for confirmations (${payment.confirmations} confirmations received)`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/status/:paymentId', authenticateAPI('payment:status'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = multiChainPaymentService.getPayment(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (!req.apiKey.permissions.includes('admin')) {
      const paymentMetadata = payment.metadata || {};
      const requestedBy = req.apiKey.key.substring(0, 8) + '...';
      
      if (paymentMetadata.requestedBy !== requestedBy) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this payment'
        });
      }
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        originalAmount: payment.originalAmount,
        amount: payment.amount,
        orderId: payment.orderId,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        txHash: payment.txHash,
        confirmations: payment.confirmations,
        verifiedAt: payment.verifiedAt,
        network: payment.network,
        networkKey: payment.networkKey,
        chainId: payment.chainId,
        token: payment.token,
        tokenName: payment.tokenName,
        contractAddress: payment.contractAddress,
        blockExplorer: payment.blockExplorer,
        walletUrls: payment.walletUrls
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/balance', authenticateAPI('payment:balance'), async (req, res) => {
  try {
    const { network } = req.query;
    
    if (network) {
      // Get balance for specific network
      const balances = await multiChainPaymentService.getAllBalances();
      const networkBalance = balances[network];
      
      if (!networkBalance) {
        return res.status(404).json({
          success: false,
          error: `Network ${network} not supported or not available`
        });
      }
      
      res.json({
        success: true,
        data: {
          walletAddress: process.env.WALLET_ADDRESS,
          network: networkBalance.network,
          chainId: networkBalance.chainId,
          balances: {
            native: networkBalance.native.native,
            tokens: networkBalance.tokens
          },
          lastUpdated: new Date().toISOString()
        }
      });
    } else {
      // Get balances for all networks
      const allBalances = await multiChainPaymentService.getAllBalances();
      
      res.json({
        success: true,
        data: {
          walletAddress: process.env.WALLET_ADDRESS,
          networks: allBalances,
          lastUpdated: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/list', authenticateAPI('admin'), async (req, res) => {
  try {
    const { status, network, token, limit = 50, offset = 0 } = req.query;
    
    const payments = Array.from(multiChainPaymentService.pendingPayments.values())
      .filter(payment => {
        if (status && payment.status !== status) return false;
        if (network && payment.networkKey !== network) return false;
        if (token && payment.token.toLowerCase() !== token.toLowerCase()) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(offset, offset + parseInt(limit));

    const total = Array.from(multiChainPaymentService.pendingPayments.values())
      .filter(payment => {
        if (status && payment.status !== status) return false;
        if (network && payment.networkKey !== network) return false;
        if (token && payment.token.toLowerCase() !== token.toLowerCase()) return false;
        return true;
      }).length;

    res.json({
      success: true,
      data: {
        payments: payments.map(payment => ({
          paymentId: payment.id,
          status: payment.status,
          originalAmount: payment.originalAmount,
          amount: payment.amount,
          orderId: payment.orderId,
          createdAt: payment.createdAt,
          expiresAt: payment.expiresAt,
          txHash: payment.txHash,
          confirmations: payment.confirmations,
          network: payment.network,
          networkKey: payment.networkKey,
          chainId: payment.chainId,
          token: payment.token,
          tokenName: payment.tokenName,
          contractAddress: payment.contractAddress,
          metadata: payment.metadata
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (offset + parseInt(limit)) < total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/networks', authenticateAPI('payment:status'), async (req, res) => {
  try {
    const supportedNetworks = multiChainPaymentService.getSupportedNetworks();
    const networksInfo = {};
    
    for (const networkKey of supportedNetworks) {
      try {
        networksInfo[networkKey] = multiChainPaymentService.getNetworkInfo(networkKey);
      } catch (error) {
        console.warn(`Failed to get info for ${networkKey}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        supported: supportedNetworks,
        details: networksInfo,
        isTestnet: process.env.NODE_ENV !== 'production'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/networks/:networkKey', authenticateAPI('payment:status'), async (req, res) => {
  try {
    const { networkKey } = req.params;
    const networkInfo = multiChainPaymentService.getNetworkInfo(networkKey);
    const supportedTokens = multiChainPaymentService.getSupportedTokens(networkKey);
    
    res.json({
      success: true,
      data: {
        ...networkInfo,
        supportedTokens
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tokens/:networkKey', authenticateAPI('payment:status'), async (req, res) => {
  try {
    const { networkKey } = req.params;
    const supportedTokens = multiChainPaymentService.getSupportedTokens(networkKey);
    const networkInfo = multiChainPaymentService.getNetworkInfo(networkKey);
    
    res.json({
      success: true,
      data: {
        network: networkInfo.name,
        chainId: networkInfo.chainId,
        supportedTokens,
        tokens: networkInfo.tokens
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;