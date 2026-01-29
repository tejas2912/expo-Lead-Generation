const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔍 Auth middleware - Starting authentication');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔍 Auth middleware - Token:', token ? 'Present' : 'Missing');

    if (!token) {
      console.log('🔍 Auth middleware - No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }

    console.log('🔍 Auth middleware - Verifying JWT');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Auth middleware - JWT decoded:', decoded);
    
    // Get user from database to ensure they still exist and are active
    const userQuery = `
      SELECT u.*, c.name as company_name, c.company_code
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.is_active = true
    `;
    
    const userResult = await query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token or user inactive' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    console.log('🔍 Role middleware - Checking roles');
    console.log('🔍 Role middleware - Required roles:', roles);
    console.log('🔍 Role middleware - User role:', req.user?.role);
    
    if (!req.user) {
      console.log('🔍 Role middleware - No user found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      console.log('🔍 Role middleware - Insufficient permissions');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    console.log('🔍 Role middleware - Role check passed');
    next();
  };
};

const requireCompanyAccess = async (req, res, next) => {
  try {
    if (req.user.role === 'platform_admin') {
      return next(); // Platform admin can access all companies
    }

    // For company_admin and employee, ensure they can only access their own company
    const companyId = req.params.companyId || req.body.company_id || req.user.company_id;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    if (req.user.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization error' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireCompanyAccess
};
