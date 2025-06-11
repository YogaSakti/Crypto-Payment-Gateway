# Multi-Chain Crypto Payment Gateway

A comprehensive payment gateway supporting USDT and USDC payments across multiple blockchain networks including Ethereum, Optimism, Arbitrum, Avalanche, Base, and BNB Smart Chain.

## 🌟 Features

- ✅ **Multi-Chain Support**: Ethereum, Optimism, Arbitrum, Avalanche, Base, BSC
- ✅ **Multi-Token Support**: USDT and USDC on all supported networks
- ✅ **Multiple Wallet Integration**: MetaMask, Trust Wallet, Coinbase Wallet
- ✅ **QR Code Generation**: Easy mobile wallet integration
- ✅ **Auto Transaction Detection**: Automatic payment verification
- ✅ **Webhook Support**: Real-time payment notifications
- ✅ **API Key Management**: Secure access control with permissions
- ✅ **Rate Limiting**: Built-in protection against abuse
- ✅ **Testnet Support**: Full testnet support for development

## 🔗 Supported Networks

### Mainnet
| Network | Chain ID | Native Token | USDT Support | USDC Support |
|---------|----------|--------------|--------------|--------------|
| Ethereum | 1 | ETH | ✅ | ✅ |
| Optimism | 10 | ETH | ✅ | ✅ |
| Arbitrum | 42161 | ETH | ✅ | ✅ |
| Avalanche | 43114 | AVAX | ✅ | ✅ |
| Base | 8453 | ETH | ✅ | ✅ |
| BSC | 56 | BNB | ✅ | ✅ |

### Testnet (Development)
| Network | Chain ID | Native Token | USDT Support | USDC Support |
|---------|----------|--------------|--------------|--------------|
| Sepolia | 11155111 | ETH | ✅ | ✅ |
| Optimism Sepolia | 11155420 | ETH | ✅ | ✅ |
| Arbitrum Sepolia | 421614 | ETH | ✅ | ✅ |
| Avalanche Fuji | 43113 | AVAX | ✅ | ✅ |
| Base Sepolia | 84532 | ETH | ✅ | ✅ |
| BSC Testnet | 97 | tBNB | ✅ | ✅ |

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/Pendetot/Crypto-Payment-Gateway.git
cd Crypto-Payment-Gateway
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start the Server
```bash
npm run dev  # Development
npm start    # Production
```

## 📝 API Documentation

### Create Payment
Create a new payment request with specified network and token.

**POST** `/api/payment/create`

```json
{
  "amount": 100.50,
  "orderId": "ORDER123",
  "network": "ethereum",  // optional, default: "ethereum"
  "token": "usdt",        // optional, default: "usdt"
  "metadata": {
    "customerId": "CUST001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid-here",
    "originalAmount": "100.50",
    "amount": "100.73",
    "network": "Ethereum",
    "chainId": 1,
    "token": "USDT",
    "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "walletAddress": "0x...",
    "walletUrls": {
      "metamask": "https://metamask.app.link/send/...",
      "trustWallet": "trust://send?...",
      "coinbaseWallet": "https://go.cb-w.com/dapp?...",
      "direct": {
        "network": "Ethereum",
        "chainId": 1,
        "contractAddress": "0x...",
        "toAddress": "0x...",
        "amount": 100.73,
        "tokenAmount": "100730000",
        "decimals": 6,
        "symbol": "USDT"
      }
    },
    "qrCode": "data:image/png;base64,...",
    "expiresAt": "2025-06-10T12:30:00.000Z"
  }
}
```

### Get Supported Networks
Get list of all supported networks and their details.

**GET** `/api/payment/networks`

**Response:**
```json
{
  "success": true,
  "data": {
    "supported": ["ethereum", "optimism", "arbitrum", "avalanche", "base", "bsc"],
    "details": {
      "ethereum": {
        "name": "Ethereum",
        "chainId": 1,
        "symbol": "ETH",
        "blockExplorer": "https://etherscan.io",
        "tokens": {
          "usdt": {
            "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "decimals": 6,
            "symbol": "USDT",
            "name": "Tether USD"
          },
          "usdc": {
            "address": "0xA0b86a33E6441b7178FcE7DcE53e9B7e3b2bB0BD",
            "decimals": 6,
            "symbol": "USDC",
            "name": "USD Coin"
          }
        },
        "minConfirmations": 12
      }
    },
    "isTestnet": false
  }
}
```

### Get Network-Specific Information
Get detailed information about a specific network.

**GET** `/api/payment/networks/{networkKey}`

### Get Supported Tokens for Network
Get all supported tokens for a specific network.

**GET** `/api/payment/tokens/{networkKey}`

### Get Wallet Balances
Get wallet balances across all networks or for a specific network.

**GET** `/api/payment/balance?network={networkKey}`

**Response (All Networks):**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "networks": {
      "ethereum": {
        "network": "Ethereum",
        "chainId": 1,
        "native": {
          "native": {
            "amount": "1.234",
            "symbol": "ETH",
            "network": "Ethereum"
          }
        },
        "tokens": {
          "usdt": {
            "amount": "5000.123456",
            "symbol": "USDT",
            "name": "Tether USD",
            "contractAddress": "0x...",
            "decimals": 6
          },
          "usdc": {
            "amount": "2000.456789",
            "symbol": "USDC",
            "name": "USD Coin",
            "contractAddress": "0x...",
            "decimals": 6
          }
        }
      }
    },
    "lastUpdated": "2025-06-10T12:00:00.000Z"
  }
}
```

### Verify Payment
Verify a payment using transaction hash.

**POST** `/api/payment/verify`

```json
{
  "paymentId": "uuid-here",
  "txHash": "0x..."
}
```

### Get Payment Status
Check the status of a specific payment.

**GET** `/api/payment/status/{paymentId}`

### List Payments (Admin)
List all payments with optional filtering.

**GET** `/api/payment/list?status=pending&network=ethereum&token=usdt&limit=50&offset=0`

## 🔐 Authentication

All endpoints require API key authentication:

```bash
# Header method
X-API-Key: your_api_key

# Bearer token method  
Authorization: Bearer your_api_key
```

### API Key Permissions
- `payment:create` - Create new payments
- `payment:verify` - Verify payments
- `payment:status` - Check payment status  
- `payment:balance` - View wallet balance
- `admin` - Full access to all endpoints

## 💳 Wallet Integration

### MetaMask Integration
The API provides MetaMask deep links for easy payment:

```javascript
// Example MetaMask URL
https://metamask.app.link/send/0xContractAddress@1/transfer?address=0xWalletAddress&uint256=100730000
```

### Trust Wallet Integration
Trust Wallet deep links for mobile payments:

```javascript
// Example Trust Wallet URL
trust://send?asset=1&address=0xWalletAddress&amount=100.73&token=0xContractAddress&memo=paymentId
```

### Coinbase Wallet Integration
Coinbase Wallet deep links:

```javascript
// Example Coinbase Wallet URL
https://go.cb-w.com/dapp?cb_url=ethereum%3A0xContractAddress%2Ftransfer%3Faddress%3D0xWalletAddress%26uint256%3D100730000
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WALLET_ADDRESS` | Receiving wallet address | Yes | - |
| `WALLET_PRIVATE_KEY` | Wallet private key | Yes | - |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | No | Public RPC |
| `OPTIMISM_RPC_URL` | Optimism RPC endpoint | No | Public RPC |
| `ARBITRUM_RPC_URL` | Arbitrum RPC endpoint | No | Public RPC |
| `AVALANCHE_RPC_URL` | Avalanche RPC endpoint | No | Public RPC |
| `BASE_RPC_URL` | Base RPC endpoint | No | Public RPC |
| `BSC_RPC_URL` | BSC RPC endpoint | No | Public RPC |
| `API_KEY` | API authentication key | No | Auto-generated |
| `WEBHOOK_SECRET` | Webhook signature secret | Yes | - |
| `PAYMENT_TIMEOUT` | Payment timeout in seconds | No | 1800 |
| `NODE_ENV` | Environment mode | No | development |

### Custom RPC Endpoints
For better performance and reliability, configure custom RPC endpoints:

```env
# Alchemy (Recommended)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Infura
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
OPTIMISM_RPC_URL=https://optimism-mainnet.infura.io/v3/YOUR_PROJECT_ID
ARBITRUM_RPC_URL=https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID

# QuickNode
ETHEREUM_RPC_URL=https://your-endpoint.ethereum.quiknode.pro/YOUR_TOKEN/
AVALANCHE_RPC_URL=https://your-endpoint.avalanche.quiknode.pro/YOUR_TOKEN/ext/bc/C/rpc
```

## 🔄 Webhook Integration

Configure webhooks to receive real-time payment notifications:

### Payment Confirmed Webhook
```json
POST /your-webhook-endpoint
{
  "paymentId": "uuid-here",
  "txHash": "0x...",
  "confirmations": 12,
  "network": "ethereum",
  "token": "usdt",
  "amount": "100.73",
  "originalAmount": "100.50"
}
```

### Transaction Notification Webhook
```json
POST /your-webhook-endpoint
{
  "txHash": "0x...",
  "toAddress": "0x...",
  "amount": 100.73,
  "token": "0x...",
  "network": "ethereum",
  "chainId": 1
}
```

### Webhook Security
Verify webhook signatures using HMAC SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  
  return signature === expectedSignature;
}
```

## 🧪 Testing

### Test with cURL

1. **Create Payment:**
```bash
curl -X POST http://localhost:3000/api/payment/create \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.5,
    "orderId": "TEST001",
    "network": "ethereum",
    "token": "usdt"
  }'
```

2. **Get Networks:**
```bash
curl -X GET http://localhost:3000/api/payment/networks \
  -H "X-API-Key: your_api_key"
```

3. **Get Balance:**
```bash
curl -X GET http://localhost:3000/api/payment/balance \
  -H "X-API-Key: your_api_key"
```

### Testnet Configuration
For development, set `NODE_ENV=development` to use testnets:

```env
NODE_ENV=development
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

## 📊 Monitoring & Analytics

### Health Check
```bash
GET /health
```

### API Documentation
```bash
GET /api/docs
```

### Payment Analytics
```bash
GET /api/payment/list?status=confirmed&network=ethereum&limit=100
```

## 🔒 Security Best Practices

1. **RPC Security**: Use authenticated RPC endpoints (Alchemy, Infura, QuickNode)
2. **API Keys**: Generate strong API keys and rotate them regularly
3. **Webhook Security**: Always verify webhook signatures
4. **Rate Limiting**: Configure appropriate rate limits for your use case
5. **Network Security**: Use HTTPS in production
6. **Private Key Security**: Store private keys securely (consider hardware wallets for production)
7. **Environment Security**: Never commit `.env` files to version control

## 📈 Performance Optimization

### RPC Optimization
- Use premium RPC providers for better reliability
- Implement RPC endpoint failover
- Cache network configurations

### Database Integration
Consider adding persistent storage for production:

```javascript
// MongoDB example
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: String,
  network: String,
  token: String,
  amount: String,
  status: String,
  txHash: String,
  createdAt: Date,
  confirmedAt: Date
});
```

## 🛠️ Advanced Features

### Custom Token Support
Add support for additional tokens by updating the network configuration:

```javascript
// src/config/networks.js
tokens: {
  usdt: { /* existing config */ },
  usdc: { /* existing config */ },
  dai: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    symbol: 'DAI',
    name: 'Dai Stablecoin'
  }
}
```

### Multi-Signature Support
Implement multi-signature wallets for enhanced security:

```javascript
const { MultiSigWallet } = require('./multisig');

// Configure multi-sig wallet
const multisig = new MultiSigWallet({
  owners: ['0x...', '0x...', '0x...'],
  required: 2
});
```

### Transaction Fee Estimation
Implement dynamic fee estimation:

```javascript
async function estimateTransactionFee(network, contractAddress) {
  const web3 = getWeb3Instance(network);
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = networkConfig.gasLimit;
  return gasPrice * gasLimit;
}
```

## 🚀 Deployment

### Production Deployment with PM2
```bash
npm install -g pm2
pm2 start app.js --name "multi-chain-payment-gateway"
pm2 startup
pm2 save
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name your-payment-gateway.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📞 Support

- **Documentation**: Full API documentation at `/api/docs`
- **Issues**: Create issues on GitHub repository
- **Contact**: [Your contact information]

## 📄 License

MIT License - see LICENSE file for details.

---

**⚠️ Security Notice**: 
- Never expose private keys in logs or error messages
- Use environment variables for all sensitive configuration
- Implement proper monitoring and alerting
- Regular security audits are recommended for production use
