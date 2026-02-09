const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware to validate JWT token (but not require specific role)
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// POST /api/visitors - Create Visitor (Mobile App Compatible)
router.post('/visitors', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Mobile visitor registration - Request received');
    console.log('🔍 Mobile visitor registration - User:', req.user);
    console.log('🔍 Mobile visitor registration - Body:', req.body);
    
    const {
      full_name,
      email,
      phone,
      organization,
      designation,
      city,
      country,
      interests,
      notes,
      follow_up_date,
      employee_id
    } = req.body;

    console.log('🔍 Mobile visitor registration - Extracted fields:', {
      full_name,
      email,
      phone,
      organization,
      designation,
      city,
      country,
      interests,
      notes,
      follow_up_date,
      employee_id
    });

    // Validate required fields
    if (!full_name || !phone) {
      console.log('🔍 Mobile visitor registration - Validation failed: missing required fields');
      return res.status(400).json({ error: 'Full name and phone are required' });
    }

    // Validate employee_id matches JWT user (security check)
    console.log('🔍 Employee ID Validation Debug:');
    console.log('🔍 - employee_id from body:', employee_id);
    console.log('🔍 - req.user.id from JWT:', req.user.id);
    console.log('🔍 - employee_id type:', typeof employee_id);
    console.log('🔍 - req.user.id type:', typeof req.user.id);
    console.log('🔍 - employee_id stringified:', String(employee_id));
    console.log('🔍 - req.user.id stringified:', String(req.user.id));
    
    // Convert both to string for comparison (UUID comparison issue)
    if (employee_id && String(employee_id) !== String(req.user.id)) {
      console.log('🔍 Mobile visitor registration - Employee ID mismatch:', employee_id, 'vs', req.user.id);
      return res.status(403).json({ error: 'Employee ID mismatch' });
    }

    const finalEmployeeId = employee_id || req.user.id;
    const companyId = req.user.company_id;
    
    console.log('🔍 Mobile visitor registration - Final IDs:', { finalEmployeeId, companyId });

    // Check if visitor already exists by phone
    const existingVisitorQuery = 'SELECT id, created_at FROM visitors WHERE phone = $1';
    const existingVisitor = await query(existingVisitorQuery, [phone]);
    
    let visitorId;
    let isNewVisitor = false;

    if (existingVisitor.rows.length > 0) {
      visitorId = existingVisitor.rows[0].id;
    } else {
      // Create new visitor
      const createVisitorQuery = `
        INSERT INTO visitors (full_name, email, phone, organization, designation, city, country, interests, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, full_name, email, phone, organization, designation, city, country, interests, created_at
      `;
      
      const visitorResult = await query(createVisitorQuery, [
        full_name, email, phone, organization, designation, city, country, interests
      ]);
      
      visitorId = visitorResult.rows[0].id;
      isNewVisitor = true;
    }

    // Create lead
    const createLeadQuery = `
      INSERT INTO visitor_leads (visitor_id, employee_id, company_id, notes, follow_up_date, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, visitor_id, employee_id, company_id, status, created_at
    `;

    const leadResult = await query(createLeadQuery, [
      visitorId, finalEmployeeId, companyId, notes, follow_up_date || null
    ]);

    // Get visitor details for response
    const visitorDetailsQuery = 'SELECT * FROM visitors WHERE id = $1';
    const visitorDetails = await query(visitorDetailsQuery, [visitorId]);

    const visitor = visitorDetails.rows[0];
    const lead = leadResult.rows[0];

    // Format response to match mobile app expectations
    const responseVisitor = {
      id: visitor.id,
      full_name: visitor.full_name,
      email: visitor.email,
      phone: visitor.phone,
      organization: visitor.organization,
      designation: visitor.designation,
      city: visitor.city,
      country: visitor.country,
      interests: visitor.interests,
      notes: notes || visitor.notes,
      follow_up_date: follow_up_date,
      employee_id: finalEmployeeId,
      created_at: visitor.created_at
    };

    const responseLead = {
      id: lead.id,
      visitor_id: lead.visitor_id,
      status: lead.status || 'new',
      created_at: lead.created_at
    };

    res.status(201).json({
      message: 'Visitor registered successfully',
      visitor: responseVisitor,
      lead: responseLead
    });

  } catch (error) {
    console.error('Mobile visitor registration error:', error);
    res.status(500).json({ error: 'Failed to register visitor' });
  }
});

// GET /api/visitors/exists/:phone - Check Visitor Exists (Mobile App Compatibility)
router.get('/visitors/exists/:phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Search for visitor by phone
    const visitorQuery = `
      SELECT id, full_name, phone, email, created_at
      FROM visitors 
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await query(visitorQuery, [phone]);

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const visitor = result.rows[0];

    // Get visit statistics
    const visitStatsQuery = `
      SELECT 
        COUNT(*) as total_visits,
        MAX(created_at) as last_visit
      FROM visitor_leads 
      WHERE visitor_id = $1
    `;

    const statsResult = await query(visitStatsQuery, [visitor.id]);
    const stats = statsResult.rows[0];

    const responseVisitor = {
      id: visitor.id,
      full_name: visitor.full_name,
      phone: visitor.phone,
      email: visitor.email,
      last_visit: stats.last_visit,
      total_visits: parseInt(stats.total_visits)
    };

    res.json({
      exists: true,
      visitor: responseVisitor
    });

  } catch (error) {
    console.error('Mobile visitor exists check error:', error);
    res.status(500).json({ error: 'Failed to check visitor existence' });
  }
});

// GET /api/visitors/check-phone/:phone - Check Phone Exists (Mobile App Compatible)
router.get('/visitors/check-phone/:phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Search for visitor by phone
    const visitorQuery = `
      SELECT id, full_name, phone, email, organization, designation, city, country, created_at
      FROM visitors 
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await query(visitorQuery, [phone]);

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const visitor = result.rows[0];

    // Get visit statistics
    const visitStatsQuery = `
      SELECT 
        COUNT(*) as total_visits,
        MAX(created_at) as last_visit
      FROM visitor_leads 
      WHERE visitor_id = $1
    `;

    const statsResult = await query(visitStatsQuery, [visitor.id]);
    const stats = statsResult.rows[0];

    const responseVisitor = {
      id: visitor.id,
      full_name: visitor.full_name,
      phone: visitor.phone,
      email: visitor.email,
      organization: visitor.organization,
      designation: visitor.designation,
      city: visitor.city,
      country: visitor.country,
      last_visit: stats.last_visit,
      total_visits: parseInt(stats.total_visits)
    };

    res.json({
      exists: true,
      visitor: responseVisitor
    });

  } catch (error) {
    console.error('Mobile check phone error:', error);
    res.status(500).json({ error: 'Failed to check phone' });
  }
});

// GET /api/visitors/phone-suggestions/:query - Phone Suggestions (Mobile App Compatible)
router.get('/visitors/phone-suggestions/:query', async (req, res) => {
  try {
    const { query: searchQuery } = req.params;

    if (!searchQuery || searchQuery.length < 1) {
      return res.status(400).json({ error: 'Query must be at least 1 character' });
    }

    // Clean query (remove non-digits)
    const cleanQuery = searchQuery.replace(/\D/g, '');
    
    if (cleanQuery.length < 1) {
      return res.json({ suggestions: [] });
    }

    // Search for visitors by phone (starting with query)
    const visitorQuery = `
      SELECT phone, full_name
      FROM visitors 
      WHERE phone LIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await query(visitorQuery, [`${cleanQuery}%`]);

    // Format suggestions as requested by mobile app
    const suggestions = result.rows.map(visitor => 
      `${visitor.phone}(${visitor.full_name})`
    );

    res.json({ suggestions });

  } catch (error) {
    console.error('Mobile phone suggestions error:', error);
    res.status(500).json({ error: 'Failed to get phone suggestions' });
  }
});

// POST /api/users/login - Login (Mobile App Compatible)
router.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user with company details
    const userQuery = `
      SELECT u.id, u.full_name, u.email, u.phone, u.password, u.role, u.is_active, u.company_id,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = $1 AND u.is_active = true
    `;

    const result = await query(userQuery, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role, 
        companyId: user.company_id 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Format response to match mobile app expectations
    const responseUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
      company_id: user.company_id,
      created_at: user.created_at
    };

    res.json({
      message: 'Login successful',
      token: token,
      user: responseUser
    });

  } catch (error) {
    console.error('Mobile login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/users/register - Register (Mobile App Compatible)
router.post('/users/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, role, company_id } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const createUserQuery = `
      INSERT INTO users (full_name, email, password, phone, role, company_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id, full_name, email, phone, role, is_active, company_id, created_at
    `;

    const result = await query(createUserQuery, [
      full_name, email, hashedPassword, phone, role || 'employee', company_id
    ]);

    const newUser = result.rows[0];

    // Format response to match mobile app expectations
    const responseUser = {
      id: newUser.id,
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      is_active: newUser.is_active,
      company_id: newUser.company_id,
      created_at: newUser.created_at
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: responseUser
    });

  } catch (error) {
    console.error('Mobile register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

module.exports = router;
