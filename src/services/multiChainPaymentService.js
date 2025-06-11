const { Web3 } = require('web3');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { validatePaymentRequest } = require('../validators/paymentValidator');
const { 
  getNetworkConfig, 
  getTokenConfig, 
  getRpcUrl, 
  ERC20_ABI,
  getSupportedNetworks,
  getSupportedTokens
} = require('../config/networks');

class MultiChainPaymentService {
  constructor() {
    this.web3Instances = new Map();
    this.pendingPayments = new Map();
    this.usedUniqueAmounts = new Set();
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.isTestnet = process.env.NODE_ENV !== 'production';
    
    // Initialize supported networks
    this.initializeNetworks();
  }

  initializeNetworks() {
    const supportedNetworks = getSupportedNetworks(this.isTestnet);
    
    for (const networkKey of supportedNetworks) {
      try {
        const rpcUrl = getRpcUrl(networkKey, this.isTestnet);
        const web3 = new Web3(rpcUrl);
        this.web3Instances.set(networkKey, web3);
        console.log(`✅ Initialized ${networkKey} network`);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize ${networkKey}:`, error.message);
      }
    }
  }

  getWeb3Instance(networkKey) {
    const web3 = this.web3Instances.get(networkKey);
    if (!web3) {
      throw new Error(`Network ${networkKey} not initialized`);
    }
    return web3;
  }

  generateUniqueAmount(originalAmount, networkKey, token) {
    let attempts = 0;
    let uniqueAmount;
    const key = `${networkKey}-${token}`;
    
    do {
      const randomCents = Math.floor(Math.random() * 99) + 1;
      const centsDecimal = randomCents / 100;
      
      uniqueAmount = parseFloat((originalAmount + centsDecimal).toFixed(6));
      attempts++;
      
      if (attempts > 50) {
        const timestamp = Date.now() % 100;
        uniqueAmount = parseFloat((originalAmount + (timestamp / 100)).toFixed(6));
        break;
      }
    } while (this.usedUniqueAmounts.has(`${key}-${uniqueAmount}`));
    
    this.usedUniqueAmounts.add(`${key}-${uniqueAmount}`);
    
    // Cleanup after 24 hours
    setTimeout(() => {
      this.usedUniqueAmounts.delete(`${key}-${uniqueAmount}`);
    }, 24 * 60 * 60 * 1000);
    
    return uniqueAmount;
  }

  async createPayment(amount, orderId, networkKey = 'ethereum', token = 'usdt', metadata = {}) {
    // Validate network and token
    const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
    const tokenConfig = getTokenConfig(networkKey, token, this.isTestnet);
    
    if (!this.web3Instances.has(networkKey)) {
      throw new Error(`Network ${networkKey} not available`);
    }

    const paymentId = uuidv4();
    const expiresAt = new Date(Date.now() + (process.env.PAYMENT_TIMEOUT || 1800) * 1000);
    
    const uniqueAmount = this.generateUniqueAmount(parseFloat(amount), networkKey, token);
    
    const paymentData = {
      id: paymentId,
      originalAmount: amount.toString(),
      amount: uniqueAmount.toString(),
      orderId,
      walletAddress: this.walletAddress,
      contractAddress: tokenConfig.address,
      network: networkConfig.name,
      networkKey: networkKey,
      chainId: networkConfig.chainId,
      token: tokenConfig.symbol,
      tokenName: tokenConfig.name,
      decimals: tokenConfig.decimals,
      blockExplorer: networkConfig.blockExplorer,
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
      metadata
    };

    // Generate wallet URLs for different wallets
    const walletUrls = this.generateWalletUrls(
      uniqueAmount, 
      paymentId, 
      networkConfig, 
      tokenConfig
    );
    
    const qrCode = await this.generateQRCode(walletUrls.metamask);

    paymentData.walletUrls = walletUrls;
    paymentData.qrCode = qrCode;

    this.pendingPayments.set(paymentId, paymentData);
    
    // Set expiration timeout
    setTimeout(() => {
      this.expirePayment(paymentId);
    }, (process.env.PAYMENT_TIMEOUT || 1800) * 1000);

    return paymentData;
  }

  generateWalletUrls(amount, paymentId, networkConfig, tokenConfig) {
    const chainId = networkConfig.chainId;
    const contractAddress = tokenConfig.address;
    const decimals = tokenConfig.decimals;
    
    // Calculate token amount with decimals
    const tokenAmount = (amount * Math.pow(10, decimals)).toString();
    
    return {
      metamask: `https://metamask.app.link/send/${contractAddress}@${chainId}/transfer?address=${this.walletAddress}&uint256=${tokenAmount}`,
      trustWallet: `trust://send?asset=${chainId}&address=${this.walletAddress}&amount=${amount}&token=${contractAddress}&memo=${paymentId}`,
      coinbaseWallet: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(`ethereum:${contractAddress}/transfer?address=${this.walletAddress}&uint256=${tokenAmount}`)}`,
      direct: {
        network: networkConfig.name,
        chainId: chainId,
        contractAddress: contractAddress,
        toAddress: this.walletAddress,
        amount: amount,
        tokenAmount: tokenAmount,
        decimals: decimals,
        symbol: tokenConfig.symbol
      }
    };
  }

  async generateQRCode(data) {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  async verifyPayment(paymentId, txHash) {
    try {
      const payment = this.pendingPayments.get(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new Error('Payment already processed');
      }

      const web3 = this.getWeb3Instance(payment.networkKey);
      
      const transaction = await web3.eth.getTransaction(txHash);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      const isValid = await this.validateTransaction(transaction, payment, web3);
      if (!isValid) {
        throw new Error('Invalid transaction');
      }

      const confirmations = await this.getConfirmations(txHash, payment.networkKey);
      const networkConfig = getNetworkConfig(payment.networkKey, this.isTestnet);
      const minConfirmations = networkConfig.minConfirmations;
      
      payment.txHash = txHash;
      payment.confirmations = confirmations;
      payment.status = confirmations >= minConfirmations ? 'confirmed' : 'pending_confirmation';
      payment.verifiedAt = new Date();

      this.pendingPayments.set(paymentId, payment);
      
      return payment;
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  async validateTransaction(transaction, payment, web3) {
    try {
      // Check if transaction is to the token contract
      if (transaction.to.toLowerCase() !== payment.contractAddress.toLowerCase()) {
        return false;
      }

      // Decode transfer function call
      const transferMethodId = '0xa9059cbb'; // transfer(address,uint256)
      
      if (!transaction.input.startsWith(transferMethodId)) {
        return false;
      }

      // Decode the input data
      const inputData = transaction.input.slice(10); // Remove method ID
      const decodedParams = web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        inputData
      );
      
      const [toAddress, amount] = decodedParams;
      
      // Calculate expected amount with token decimals
      const expectedAmount = (parseFloat(payment.amount) * Math.pow(10, payment.decimals)).toString();
      
      return toAddress.toLowerCase() === this.walletAddress.toLowerCase() && 
             amount.toString() === expectedAmount;
    } catch (error) {
      console.error('Transaction validation error:', error);
      return false;
    }
  }

  findPaymentByAmount(amount, networkKey, token) {
    const numAmount = parseFloat(amount);
    
    for (const [paymentId, payment] of this.pendingPayments) {
      if (payment.status === 'pending' && 
          payment.networkKey === networkKey &&
          payment.token.toLowerCase() === token.toLowerCase() &&
          parseFloat(payment.amount) === numAmount) {
        return { paymentId, payment };
      }
    }
    return null;
  }

  async getConfirmations(txHash, networkKey) {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const transaction = await web3.eth.getTransaction(txHash);
      
      if (!transaction || !transaction.blockNumber) {
        return 0;
      }

      const currentBlock = await web3.eth.getBlockNumber();
      return Number(currentBlock) - Number(transaction.blockNumber) + 1;
    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }

  getPayment(paymentId) {
    return this.pendingPayments.get(paymentId);
  }

  expirePayment(paymentId) {
    const payment = this.pendingPayments.get(paymentId);
    if (payment && payment.status === 'pending') {
      payment.status = 'expired';
      this.pendingPayments.set(paymentId, payment);
      
      // Remove from unique amounts
      const key = `${payment.networkKey}-${payment.token}-${payment.amount}`;
      this.usedUniqueAmounts.delete(key);
    }
  }

  async getWalletBalance(networkKey) {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
      
      const balance = await web3.eth.getBalance(this.walletAddress);
      const balanceInEther = web3.utils.fromWei(balance, 'ether');
      
      return {
        native: {
          amount: balanceInEther,
          symbol: networkConfig.symbol,
          network: networkConfig.name
        }
      };
    } catch (error) {
      throw new Error(`Failed to get wallet balance for ${networkKey}: ${error.message}`);
    }
  }

  async getTokenBalance(networkKey, tokenSymbol) {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const tokenConfig = getTokenConfig(networkKey, tokenSymbol, this.isTestnet);
      
      const contract = new web3.eth.Contract(ERC20_ABI, tokenConfig.address);
      const balance = await contract.methods.balanceOf(this.walletAddress).call();
      
      const balanceFormatted = (parseFloat(balance) / Math.pow(10, tokenConfig.decimals)).toString();
      
      return {
        amount: balanceFormatted,
        symbol: tokenConfig.symbol,
        name: tokenConfig.name,
        contractAddress: tokenConfig.address,
        decimals: tokenConfig.decimals
      };
    } catch (error) {
      throw new Error(`Failed to get ${tokenSymbol} balance on ${networkKey}: ${error.message}`);
    }
  }

  async getAllBalances() {
    const balances = {};
    const supportedNetworks = getSupportedNetworks(this.isTestnet);
    
    for (const networkKey of supportedNetworks) {
      if (!this.web3Instances.has(networkKey)) continue;
      
      try {
        const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
        balances[networkKey] = {
          network: networkConfig.name,
          chainId: networkConfig.chainId,
          native: await this.getWalletBalance(networkKey),
          tokens: {}
        };
        
        // Get token balances
        const supportedTokens = getSupportedTokens(networkKey, this.isTestnet);
        for (const token of supportedTokens) {
          try {
            balances[networkKey].tokens[token] = await this.getTokenBalance(networkKey, token);
          } catch (error) {
            console.warn(`Failed to get ${token} balance on ${networkKey}:`, error.message);
          }
        }
      } catch (error) {
        console.warn(`Failed to get balances for ${networkKey}:`, error.message);
      }
    }
    
    return balances;
  }

  getSupportedNetworks() {
    return getSupportedNetworks(this.isTestnet);
  }

  getSupportedTokens(networkKey) {
    return getSupportedTokens(networkKey, this.isTestnet);
  }

  getNetworkInfo(networkKey) {
    const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
    return {
      name: networkConfig.name,
      chainId: networkConfig.chainId,
      symbol: networkConfig.symbol,
      blockExplorer: networkConfig.blockExplorer,
      tokens: networkConfig.tokens,
      minConfirmations: networkConfig.minConfirmations
    };
  }
}

module.exports = new MultiChainPaymentService();
