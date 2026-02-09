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
    console.log('🔍 Mobile visitor registration - Body:');
    console.log('🔍 Request Body Analysis:');
    console.log('🔍 - Raw request body:', req.body);
    console.log('🔍 - Request body type:', typeof req.body);
    console.log('🔍 - Request body keys:', Object.keys(req.body));
    console.log('🔍 - Request body values:', Object.values(req.body));
    
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

    console.log('🔍 Extracted fields:');
    console.log('🔍 - full_name:', full_name, 'type:', typeof full_name);
    console.log('🔍 - email:', email, 'type:', typeof email);
    console.log('🔍 - phone:', phone, 'type:', typeof phone);
    console.log('🔍 - organization:', organization, 'type:', typeof organization);
    console.log('🔍 - designation:', designation, 'type:', typeof designation);
    console.log('🔍 - city:', city, 'type:', typeof city);
    console.log('🔍 - country:', country, 'type:', typeof country);
    console.log('🔍 - interests:', interests, 'type:', typeof interests);
    console.log('🔍 - notes:', notes, 'type:', typeof notes);
    console.log('🔍 - follow_up_date:', follow_up_date, 'type:', typeof follow_up_date);
    console.log('🔍 - employee_id:', employee_id, 'type:', typeof employee_id);

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

    // Main try-catch wrapper to catch all errors
    try {
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
      
      // Always use JWT user.id for security and reliability
      const finalEmployeeId = req.user.id;  // Use JWT user.id, not request employee_id
      const companyId = req.user.company_id;
      
      console.log('🔍 Mobile visitor registration - Using JWT user:', { finalEmployeeId, companyId });

      // Check if visitor already exists by phone
      const existingVisitorQuery = 'SELECT id, created_at FROM visitors WHERE phone = $1';
      const existingVisitor = await query(existingVisitorQuery, [phone]);
      
      let visitorId;
      let isNewVisitor = false;

      if (existingVisitor.rows.length > 0) {
        visitorId = existingVisitor.rows[0].id;
      } else {
        // Create new visitor
        console.log('🔍 Creating new visitor with data:', {
          full_name, email, phone, organization, designation, city, country
        });
        
        const createVisitorQuery = `
          INSERT INTO visitors (full_name, email, phone, organization, designation, city, country, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          RETURNING id, full_name, email, phone, organization, designation, city, country, created_at
        `;
        
        console.log('🔍 Visitor SQL query:', createVisitorQuery);
        console.log('🔍 Visitor SQL parameters:', [
          full_name !== undefined ? full_name : null, 
          email !== undefined ? email : null, 
          phone !== undefined ? phone : null, 
          organization !== undefined ? organization : null, 
          designation !== undefined ? designation : null, 
          city !== undefined ? city : null, 
          country !== undefined ? country : null
        ]);
        
        let visitorResult;
        try {
          visitorResult = await query(createVisitorQuery, [
            full_name !== undefined ? full_name : null,  // $1
            email !== undefined ? email : null,     // $2
            phone !== undefined ? phone : null,     // $3
            organization !== undefined ? organization : null, // $4
            designation !== undefined ? designation : null, // $5
            city !== undefined ? city : null        // $6
          ]);
          console.log('🔍 Visitor created successfully:', visitorResult.rows[0]);
        } catch (visitorError) {
          console.error('❌ Visitor creation error:', visitorError);
          console.error('❌ Visitor error details:', {
            message: visitorError.message,
            stack: visitorError.stack,
            query: createVisitorQuery,
            parameters: [full_name, email, phone, organization, designation, city, country]
          });
          throw visitorError;
        }
        
        visitorId = visitorResult.rows[0].id;
        isNewVisitor = true;
      }

      // Create lead
      console.log('🔍 Creating lead with data:', {
        visitorId, finalEmployeeId, companyId, interests, organization, designation, city, country, notes, follow_up_date
      });
      
      const createLeadQuery = `
        INSERT INTO visitor_leads (visitor_id, employee_id, company_id, interests, organization, designation, city, country, notes, follow_up_date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, visitor_id, employee_id, company_id, created_at
      `;
      
      console.log('🔍 Lead SQL query:', createLeadQuery);
      console.log('🔍 Lead SQL parameters:', [
        visitorId,           // $1
        finalEmployeeId,      // $2
        companyId,           // $3
        interests !== undefined ? interests : null,   // $4
        organization !== undefined ? organization : null, // $5
        designation !== undefined ? designation : null, // $6
        city !== undefined ? city : null,       // $7
        country !== undefined ? country : null,     // $8
        notes !== undefined ? notes : null,       // $9
        // created_at uses NOW() directly
      ]);
      
      let leadResult;
      try {
        leadResult = await query(createLeadQuery, [
          visitorId,           // $1
          finalEmployeeId,      // $2
          companyId,           // $3
          interests !== undefined ? interests : null,   // $4
          organization !== undefined ? organization : null, // $5
          designation !== undefined ? designation : null, // $6
          city !== undefined ? city : null,       // $7
          country !== undefined ? country : null,     // $8
          notes !== undefined ? notes : null        // $9
        ]);
        console.log('🔍 Lead created successfully:', leadResult.rows[0]);
      } catch (leadError) {
        console.error('❌ Lead creation error:', leadError);
        console.error('❌ Lead error details:', {
          message: leadError.message,
          stack: leadError.stack,
          query: createLeadQuery,
          parameters: [visitorId, finalEmployeeId, companyId, interests, organization, designation, city, country, notes, follow_up_date || null]
        });
        throw leadError;
      }

      // Get visitor details for response
      console.log('🔍 Getting visitor details for response...');
      console.log('🔍 - visitorId for query:', visitorId);
      console.log('🔍 - visitorId type:', typeof visitorId);
      
      const visitorDetailsQuery = 'SELECT * FROM visitors WHERE id = $1';
      const visitorDetails = await query(visitorDetailsQuery, [visitorId]);
      
      console.log('🔍 Visitor details query result:', visitorDetails.rows);
      console.log('🔍 - Visitor details row count:', visitorDetails.rows.length);
      
      if (visitorDetails.rows.length === 0) {
        console.error('❌ CRITICAL: Visitor not found after creation! visitorId:', visitorId);
        throw new Error('Visitor not found after creation');
      }

      const visitor = visitorDetails.rows[0];
      console.log('🔍 Retrieved visitor from DB:', visitor);
      const lead = leadResult.rows[0];
      console.log('🔍 Lead creation result analysis:');
      console.log('🔍 - Lead result rows:', leadResult.rows);
      console.log('🔍 - Lead result row count:', leadResult.rows.length);
      console.log('🔍 - Retrieved lead from DB:', lead);
      console.log('🔍 - Lead ID:', lead.id);
      console.log('🔍 - Lead visitor_id:', lead.visitor_id);
      console.log('🔍 - Lead employee_id:', lead.employee_id);
      console.log('🔍 - Lead company_id:', lead.company_id);
      console.log('🔍 - Lead interests:', lead.interests);
      console.log('🔍 - Lead organization:', lead.organization);
      console.log('🔍 - Lead designation:', lead.designation);
      console.log('🔍 - Lead city:', lead.city);
      console.log('🔍 - Lead country:', lead.country);
      console.log('🔍 - Lead notes:', lead.notes);
      console.log('🔍 - Lead follow_up_date:', lead.follow_up_date);
      console.log('🔍 - Lead created_at:', lead.created_at);

      // Format response to match mobile app expectations
      console.log('🔍 Formatting response - Field mapping debug:');
      console.log('🔍 - Raw visitor data from DB:', visitor);
      console.log('🔍 - Raw lead data from DB:', lead);
      console.log('🔍 - Request body fields:', Object.keys(req.body));
      console.log('🔍 - Request body values:', req.body);
      
      const responseVisitor = {
        id: visitor.id,
        full_name: visitor.full_name,
        phone: visitor.phone,
        email: visitor.email,
        organization: visitor.organization,
        designation: visitor.designation,
        city: visitor.city,
        country: visitor.country,
        created_at: visitor.created_at
      };

      const responseLead = {
        id: lead.id,
        visitor_id: lead.visitor_id,
        employee_id: lead.employee_id,
        company_id: lead.company_id,
        interests: interests,  // From request body, not DB
        organization: organization,  // From request body, not DB
        designation: designation,  // From request body, not DB
        city: city,          // From request body, not DB
        country: country,      // From request body, not DB
        notes: notes,          // From request body, not DB
        follow_up_date: lead.follow_up_date,
        created_at: lead.created_at
      };

      console.log('🔍 - Response visitor object:', responseVisitor);
      console.log('🔍 - Response lead object:', responseLead);
      console.log('🔍 - Final response structure:', {
        message: 'Visitor registered successfully',
        visitor: responseVisitor,
        lead: responseLead
      });

      console.log('🔍 Mobile visitor registration - Success:', { 
        visitor: responseVisitor, 
        lead: responseLead,
        isNewVisitor 
      });

      res.status(201).json({
        message: 'Visitor registered successfully',
        visitor: responseVisitor,
        lead: responseLead
      });

    } catch (error) {
      console.error('❌ Mobile visitor registration - Main error:', error);
      console.error('❌ Main error details:', {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
        user: req.user
      });
      res.status(500).json({ 
        error: 'Failed to register visitor',
        details: error.message 
      });
    }

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
