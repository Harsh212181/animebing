// middleware/adminAuth.cjs - SECURE VERSION
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET missing in environment variables');
  process.exit(1);
}

module.exports = function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Access denied! No token provided.' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Access denied! Invalid token format.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Additional security checks
    if (!decoded.id || !decoded.username) {
      return res.status(401).json({ 
        success: false,
        error: 'Access denied! Invalid token payload.' 
      });
    }
    
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: 'Token expired! Please login again.' 
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token!' 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      error: 'Authentication failed!' 
    });
  }
};