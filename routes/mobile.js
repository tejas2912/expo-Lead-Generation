const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, createLeadSchema, updateLeadSchema } = require('../middleware/validation');

const router = express.Router();

// Mobile-specific authentication middleware - forces role = employee
const requireMobileAuth = (req, res, next) => {
  console.log('🔍 Mobile Auth - Starting mobile authentication');
  
  if (!req.user) {
    console.log('🔍 Mobile Auth - No user found');
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Force role to be employee for all mobile routes
  if (req.user.role !== 'employee') {
    console.log('🔍 Mobile Auth - User role:', req.user.role);
    return res.status(403).json({ error: 'Mobile access restricted to employees only' });
  }

  // Ensure employee has company_id
  if (!req.user.company_id) {
    return res.status(401).json({ error: 'Employee must be assigned to a company' });
  }

  console.log('🔍 Mobile Auth - Employee authentication successful');
  next();
};

// Mobile Login - same as web but with mobile-specific response
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userQuery = `
      SELECT u.*, c.name as company_name, c.company_code
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = $1 AND u.is_active = true
    `;
    
    const userResult = await query(userQuery, [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Mobile login restricted to employees only
    if (user.role !== 'employee') {
      return res.status(403).json({ error: 'Mobile access restricted to employees only' });
    }

    // Check company status
    if (!user.company_id) {
      return res.status(401).json({ error: 'Employee must be assigned to a company' });
    }

    const companyStatusQuery = 'SELECT status FROM companies WHERE id = $1';
    const companyResult = await query(companyStatusQuery, [user.company_id]);
    
    if (companyResult.rows.length === 0) {
      return res.status(401).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];
    if (company.status !== 'active') {
      return res.status(401).json({ error: 'Company is inactive. Please contact your administrator.' });
    }

    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.company_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove sensitive data from response
    const { password_hash, ...userResponse } = user;

    res.json({
      message: 'Mobile login successful',
      token,
      user: {
        id: userResponse.id,
        email: userResponse.email,
        full_name: userResponse.full_name,
        phone: userResponse.phone,
        role: userResponse.role,
        company_id: userResponse.company_id,
        company_name: userResponse.company_name,
        company_code: userResponse.company_code,
        is_active: userResponse.is_active
      }
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    res.status(500).json({ error: 'Mobile login failed' });
  }
});

// Mobile Registration - force role = employee
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone, company_code } = req.body;

    // Check if email already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await query(existingUserQuery, [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Find company by company_code
    const companyQuery = 'SELECT id FROM companies WHERE company_code = $1 AND status = $2';
    const companyResult = await query(companyQuery, [company_code, 'active']);
    
    if (companyResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid company code or company inactive' });
    }

    const company_id = companyResult.rows[0].id;

    // Hash password
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new employee with forced role = employee
    const insertUserQuery = `
      INSERT INTO users (email, password_hash, full_name, phone, role, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, phone, role, company_id, is_active, created_at
    `;

    const newUserResult = await query(insertUserQuery, [
      email, password_hash, full_name, phone, 'employee', company_id
    ]);

    const newUser = newUserResult.rows[0];

    res.status(201).json({
      message: 'Employee registration successful',
      user: newUser
    });
  } catch (error) {
    console.error('Mobile registration error:', error);
    res.status(500).json({ error: 'Mobile registration failed' });
  }
});

// Get current employee profile
router.get('/profile', authenticateToken, requireMobileAuth, async (req, res) => {
  try {
    const { password_hash, ...userProfile } = req.user;
    res.json({ 
      message: 'Employee profile retrieved successfully',
      user: userProfile 
    });
  } catch (error) {
    console.error('Mobile profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update employee profile
router.put('/profile', authenticateToken, requireMobileAuth, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    
    const updateQuery = `
      UPDATE users 
      SET full_name = $1, phone = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, full_name, phone, role, company_id, is_active, updated_at
    `;

    const result = await query(updateQuery, [full_name, phone, req.user.id]);
    const updatedUser = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Mobile profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Mobile Lead Creation - reuse existing lead creation logic
router.post('/leads', 
  authenticateToken, 
  requireMobileAuth, 
  validateRequest(createLeadSchema), 
  async (req, res) => {
    try {
      // Import the lead creation logic from existing leads.js
      const { 
        visitor_id,
        phone,
        full_name,
        email,
        organization,
        designation,
        city,
        country,
        interests,
        notes,
        follow_up_date,
      } = req.body;

      // Force company_id from JWT (never from request body)
      const company_id = req.user.company_id;
      const employee_id = req.user.id;

      let visitorResult;
      let finalVisitorId;

      if (visitor_id) {
        // Case 1: Existing visitor - check if exists
        const visitorQuery = 'SELECT id, phone, full_name FROM visitors WHERE id = $1';
        visitorResult = await query(visitorQuery, [visitor_id]);
        
        if (visitorResult.rows.length === 0) {
          return res.status(404).json({ error: 'Visitor not found' });
        }
        finalVisitorId = visitor_id;
      } else {
        // Case 2: New visitor - create visitor first
        if (!phone || !full_name) {
          return res.status(400).json({ error: 'Phone and full name are required for new visitor' });
        }

        // Check if visitor already exists by phone
        const existingVisitorQuery = 'SELECT id FROM visitors WHERE phone = $1';
        const existingVisitor = await query(existingVisitorQuery, [phone]);
        
        if (existingVisitor.rows.length > 0) {
          finalVisitorId = existingVisitor.rows[0].id;
        } else {
          // Create new visitor
          const createVisitorQuery = `
            INSERT INTO visitors (phone, full_name, email, organization, designation, city, country, interests)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, phone, full_name, email, organization, designation, city, country, interests, created_at
          `;
          
          const visitorData = await query(createVisitorQuery, [
            phone, full_name, email, organization, designation, city, country, interests
          ]);
          
          finalVisitorId = visitorData.rows[0].id;
        }
      }

      // Create lead
      const createLeadQuery = `
        INSERT INTO visitor_leads (visitor_id, employee_id, company_id, notes, follow_up_date, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, visitor_id, employee_id, company_id, notes, follow_up_date, created_at
      `;

      const leadResult = await query(createLeadQuery, [
        finalVisitorId, employee_id, company_id, notes, follow_up_date || null
      ]);

      const newLead = leadResult.rows[0];

      // Get visitor details for response
      const visitorDetailsQuery = 'SELECT * FROM visitors WHERE id = $1';
      const visitorDetails = await query(visitorDetailsQuery, [finalVisitorId]);

      res.status(201).json({
        message: 'Lead created successfully',
        lead: newLead,
        visitor: visitorDetails.rows[0]
      });
    } catch (error) {
      console.error('Mobile lead creation error:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }
);

// Get employee's leads
router.get('/leads', authenticateToken, requireMobileAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE vl.employee_id = $1';
    let queryParams = [req.user.id];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (v.full_name ILIKE $${paramIndex} OR v.phone ILIKE $${paramIndex} OR v.organization ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const leadsQuery = `
      SELECT 
        vl.*,
        v.full_name as visitor_name,
        v.phone as visitor_phone,
        v.email as visitor_email,
        v.organization as visitor_organization,
        v.designation as visitor_designation,
        v.city as visitor_city,
        v.country as visitor_country,
        v.interests as visitor_interests
      FROM visitor_leads vl
      LEFT JOIN visitors v ON vl.visitor_id = v.id
      ${whereClause}
      ORDER BY vl.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM visitor_leads vl 
      LEFT JOIN visitors v ON vl.visitor_id = v.id 
      ${whereClause}
    `;

    queryParams.push(limit, offset);

    const [leadsResult, countResult] = await Promise.all([
      query(leadsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalRecords = countResult.rows[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      message: 'Leads retrieved successfully',
      leads: leadsResult.rows,
      pagination: {
        total_records: totalRecords,
        total_pages: totalPages,
        current_page: parseInt(page),
        has_prev: parseInt(page) > 1,
        has_next: parseInt(page) < totalPages,
      },
    });
  } catch (error) {
    console.error('Mobile leads fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Update lead
router.put('/leads/:id', 
  authenticateToken, 
  requireMobileAuth, 
  validateRequest(updateLeadSchema), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { notes, follow_up_date } = req.body;

      // Verify lead belongs to this employee
      const leadQuery = 'SELECT * FROM visitor_leads WHERE id = $1 AND employee_id = $2';
      const leadResult = await query(leadQuery, [id, req.user.id]);
      
      if (leadResult.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found or access denied' });
      }

      // Update lead
      const updateLeadQuery = `
        UPDATE visitor_leads 
        SET notes = $1, follow_up_date = $2, updated_at = NOW()
        WHERE id = $3 AND employee_id = $4
        RETURNING *
      `;

      const result = await query(updateLeadQuery, [notes, follow_up_date || null, id, req.user.id]);
      const updatedLead = result.rows[0];

      res.json({
        message: 'Lead updated successfully',
        lead: updatedLead
      });
    } catch (error) {
      console.error('Mobile lead update error:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }
);

// Search visitors (global search)
router.get('/visitors/search', authenticateToken, requireMobileAuth, async (req, res) => {
  try {
    const { phone, full_name } = req.query;
    
    if (!phone && !full_name) {
      return res.status(400).json({ error: 'Phone or full name is required for search' });
    }

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;

    if (phone) {
      whereClause += ` AND phone ILIKE $${paramIndex}`;
      queryParams.push(`%${phone}%`);
      paramIndex++;
    }

    if (full_name) {
      whereClause += ` AND full_name ILIKE $${paramIndex}`;
      queryParams.push(`%${full_name}%`);
      paramIndex++;
    }

    const searchQuery = `
      SELECT * FROM visitors 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const result = await query(searchQuery, queryParams);

    res.json({
      message: 'Visitors searched successfully',
      visitors: result.rows
    });
  } catch (error) {
    console.error('Mobile visitor search error:', error);
    res.status(500).json({ error: 'Failed to search visitors' });
  }
});

module.exports = router;
