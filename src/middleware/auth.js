const crypto = require('crypto');

const apiKeys = new Map();

function generateAPIKey() {
  return crypto.randomBytes(32).toString('hex');
}

function initializeAPIKey() {
  const defaultKey = process.env.API_KEY || generateAPIKey();
  
  if (!process.env.API_KEY) {
    console.log('⚠️  No API_KEY found in environment variables');
    console.log(`🔑 Generated API Key: ${defaultKey}`);
    console.log('📝 Add this to your .env file: API_KEY=' + defaultKey);
  }
  
  apiKeys.set(defaultKey, {
    key: defaultKey,
    name: 'Default Admin Key',
    permissions: ['admin', 'payment:create', 'payment:verify', 'payment:status', 'payment:balance'],
    createdAt: new Date(),
    lastUsed: null,
    isActive: true
  });
  
  return defaultKey;
}

function addAPIKey(name, permissions = ['payment:create', 'payment:verify', 'payment:status']) {
  const key = generateAPIKey();
  apiKeys.set(key, {
    key,
    name,
    permissions,
    createdAt: new Date(),
    lastUsed: null,
    isActive: true
  });
  return key;
}

function revokeAPIKey(key) {
  const keyData = apiKeys.get(key);
  if (keyData) {
    keyData.isActive = false;
    return true;
  }
  return false;
}

function listAPIKeys() {
  const keys = [];
  for (const [key, data] of apiKeys) {
    keys.push({
      id: key.substring(0, 8) + '...',
      name: data.name,
      permissions: data.permissions,
      createdAt: data.createdAt,
      lastUsed: data.lastUsed,
      isActive: data.isActive
    });
  }
  return keys;
}

function authenticateAPI(requiredPermission = null) {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Provide API key in X-API-Key header or Authorization: Bearer <key>'
      });
    }

    const keyData = apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key'
      });
    }

    if (requiredPermission && !keyData.permissions.includes(requiredPermission) && !keyData.permissions.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: requiredPermission
      });
    }

    keyData.lastUsed = new Date();
    
    req.apiKey = keyData;
    
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.apiKey?.permissions.includes('admin')) {
    return res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    });
  }
  next();
}

const apiKeyRateLimits = new Map();

function rateLimitByAPIKey(windowMs = 15 * 60 * 1000, maxRequests = 100) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return next();
    }

    const key = req.apiKey.key;
    const now = Date.now();
    
    if (!apiKeyRateLimits.has(key)) {
      apiKeyRateLimits.set(key, {
        requests: [],
        windowStart: now
      });
    }

    const keyLimits = apiKeyRateLimits.get(key);
    
    keyLimits.requests = keyLimits.requests.filter(time => now - time < windowMs);
    
    if (keyLimits.requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for this API key',
        resetTime: new Date(keyLimits.requests[0] + windowMs)
      });
    }

    keyLimits.requests.push(now);
    next();
  };
}

const defaultAPIKey = initializeAPIKey();

module.exports = {
  authenticateAPI,
  requireAdmin,
  rateLimitByAPIKey,
  generateAPIKey,
  addAPIKey,
  revokeAPIKey,
  listAPIKeys,
  defaultAPIKey
};