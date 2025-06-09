const { Web3 } = require('web3');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { validatePaymentRequest } = require('../validators/paymentValidator');

class PaymentService {
  constructor() {
    this.web3 = new Web3(process.env.BSC_RPC_URL);
    this.usdtContract = process.env.USDT_CONTRACT_ADDRESS;
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.pendingPayments = new Map();
    this.usedUniqueAmounts = new Set();
  }

  generateUniqueAmount(originalAmount) {
    let attempts = 0;
    let uniqueAmount;
    
    do {
      const randomCents = Math.floor(Math.random() * 99) + 1;
      const centsDecimal = randomCents / 100;
      
      uniqueAmount = parseFloat((originalAmount + centsDecimal).toFixed(2));
      attempts++;
      
      if (attempts > 50) {
        const timestamp = Date.now() % 100;
        uniqueAmount = parseFloat((originalAmount + (timestamp / 100)).toFixed(2));
        break;
      }
    } while (this.usedUniqueAmounts.has(uniqueAmount));
    
    this.usedUniqueAmounts.add(uniqueAmount);
    
    setTimeout(() => {
      this.usedUniqueAmounts.delete(uniqueAmount);
    }, 24 * 60 * 60 * 1000);
    
    return uniqueAmount;
  }

  async createPayment(amount, orderId, metadata = {}) {
    const paymentId = uuidv4();
    const expiresAt = new Date(Date.now() + (process.env.PAYMENT_TIMEOUT * 1000));
    
    const uniqueAmount = this.generateUniqueAmount(parseFloat(amount));
    
    const paymentData = {
      id: paymentId,
      originalAmount: amount.toString(), 
      amount: uniqueAmount.toString(), 
      orderId,
      walletAddress: this.walletAddress,
      contractAddress: this.usdtContract,
      network: 'BSC',
      token: 'USDT',
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
      metadata
    };

    const trustWalletUrl = this.generateTrustWalletUrl(uniqueAmount, paymentId);
    const qrCode = await this.generateQRCode(trustWalletUrl);

    paymentData.trustWalletUrl = trustWalletUrl;
    paymentData.qrCode = qrCode;

    this.pendingPayments.set(paymentId, paymentData);
    
    setTimeout(() => {
      this.expirePayment(paymentId);
    }, process.env.PAYMENT_TIMEOUT * 1000);

    return paymentData;
  }

  generateTrustWalletUrl(amount, paymentId) {
    const params = new URLSearchParams({
      address: this.walletAddress,
      amount: amount.toString(),
      token: this.usdtContract,
      memo: paymentId
    });
    
    return `trust://send?${params.toString()}`;
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

      const transaction = await this.web3.eth.getTransaction(txHash);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      const isValid = await this.validateTransaction(transaction, payment);
      if (!isValid) {
        throw new Error('Invalid transaction');
      }

      const confirmations = await this.getConfirmations(txHash);
      
      payment.txHash = txHash;
      payment.confirmations = confirmations;
      payment.status = confirmations >= process.env.MIN_CONFIRMATIONS ? 'confirmed' : 'pending_confirmation';
      payment.verifiedAt = new Date();

      this.pendingPayments.set(paymentId, payment);
      
      return payment;
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  async validateTransaction(transaction, payment) {
    if (transaction.to.toLowerCase() !== this.usdtContract.toLowerCase()) {
      return false;
    }

    try {
      const decodedInput = this.web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        transaction.input.slice(10)
      );
      
      const [toAddress, amount] = decodedInput;
      const expectedAmount = this.web3.utils.toWei(payment.amount, 'mwei');
      
      return toAddress.toLowerCase() === this.walletAddress.toLowerCase() && 
             amount.toString() === expectedAmount.toString();
    } catch (error) {
      return false;
    }
  }

  findPaymentByAmount(amount) {
    const numAmount = parseFloat(amount);
    
    for (const [paymentId, payment] of this.pendingPayments) {
      if (payment.status === 'pending' && 
          parseFloat(payment.amount) === numAmount) {
        return { paymentId, payment };
      }
    }
    return null;
  }

  async getConfirmations(txHash) {
    try {
      const transaction = await this.web3.eth.getTransaction(txHash);
      if (!transaction || !transaction.blockNumber) {
        return 0;
      }

      const currentBlock = await this.web3.eth.getBlockNumber();
      return currentBlock - transaction.blockNumber + 1;
    } catch (error) {
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
            
      this.usedUniqueAmounts.delete(parseFloat(payment.amount));
    }
  }

  async getWalletBalance() {
    try {
      const balance = await this.web3.eth.getBalance(this.walletAddress);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      throw new Error('Failed to get wallet balance');
    }
  }

  async getUSDTBalance() {
    try {
      const contract = new this.web3.eth.Contract([
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }
      ], this.usdtContract);

      const balance = await contract.methods.balanceOf(this.walletAddress).call();
      return this.web3.utils.fromWei(balance, 'mwei');
    } catch (error) {
      throw new Error('Failed to get USDT balance');
    }
  }
}

module.exports = new PaymentService();