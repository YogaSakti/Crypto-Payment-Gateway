const express = require('express');
const { 
  authenticateAPI, 
  requireAdmin, 
  addAPIKey, 
  revokeAPIKey, 
  listAPIKeys 
} = require('../middleware/auth');

const router = express.Router();

router.post('/create', authenticateAPI(), requireAdmin, (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const validPermissions = [
      'payment:create',
      'payment:verify', 
      'payment:status',
      'payment:balance',
      'admin'
    ];

    const keyPermissions = permissions || ['payment:create', 'payment:verify', 'payment:status'];
    
    const invalidPermissions = keyPermissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permissions',
        invalid: invalidPermissions,
        valid: validPermissions
      });
    }

    const newKey = addAPIKey(name, keyPermissions);
    
    res.json({
      success: true,
      data: {
        apiKey: newKey,
        name,
        permissions: keyPermissions,
        message: 'Store this API key securely. It will not be shown again.'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/list', authenticateAPI(), requireAdmin, (req, res) => {
  try {
    const keys = listAPIKeys();
    
    res.json({
      success: true,
      data: {
        keys,
        total: keys.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/revoke', authenticateAPI(), requireAdmin, (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    if (apiKey === req.apiKey.key) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke your own API key'
      });
    }

    const success = revokeAPIKey(apiKey);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/info', authenticateAPI(), (req, res) => {
  try {
    const { key, ...keyInfo } = req.apiKey;
    
    res.json({
      success: true,
      data: {
        ...keyInfo,
        keyId: key.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;