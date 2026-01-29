const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, createCompanySchema, createCompanyAdminSchema, updateUserSchema } = require('../middleware/validation');

const router = express.Router();

// ============ COMPANY MANAGEMENT ============

// Get all companies (platform admin only)
router.get('/companies', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereClause = `WHERE name ILIKE $${paramIndex} OR company_code ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      const statusClause = whereClause ? 'AND' : 'WHERE';
      whereClause += ` ${statusClause} status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    const companiesQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.role = 'company_admin' THEN u.id END) as company_admins,
        COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) as employees,
        COUNT(DISTINCT vl.id) as total_leads
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id AND u.is_active = true
      LEFT JOIN visitor_leads vl ON c.id = vl.company_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM companies ${whereClause}
    `;

    queryParams.push(limit, offset);

    const [companiesResult, countResult] = await Promise.all([
      query(companiesQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      companies: companiesResult.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create new company (platform admin only)
router.post('/companies', 
  authenticateToken, 
  requireRole(['platform_admin']), 
  validateRequest(createCompanySchema), 
  async (req, res) => {
    try {
      const { name, contact_email, contact_phone, company_code } = req.body;

      // Check if company code already exists
      if (company_code) {
        const existingCodeQuery = 'SELECT id FROM companies WHERE company_code = $1';
        const existingCode = await query(existingCodeQuery, [company_code]);
        
        if (existingCode.rows.length > 0) {
          return res.status(400).json({ error: 'Company code already exists' });
        }
      }

      // Generate company code if not provided
      const finalCompanyCode = company_code || `COMP${Date.now().toString().slice(-6)}`;

      // Create company
      const insertCompanyQuery = `
        INSERT INTO companies (name, contact_email, contact_phone, company_code)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await query(insertCompanyQuery, [name, contact_email, contact_phone, finalCompanyCode]);
      const newCompany = result.rows[0];

      res.status(201).json({
        message: 'Company created successfully',
        company: newCompany
      });
    } catch (error) {
      console.error('Create company error:', error);
      
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Company code already exists' });
      }
      
      res.status(500).json({ error: 'Failed to create company' });
    }
  }
);

// Update company (platform admin only)
router.put('/companies/:id', 
  authenticateToken, 
  requireRole(['platform_admin']), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, contact_email, contact_phone, status } = req.body;

      // Check if company exists
      const existingCompanyQuery = 'SELECT id FROM companies WHERE id = $1';
      const existingCompany = await query(existingCompanyQuery, [id]);
      
      if (existingCompany.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Update company
      const updateCompanyQuery = `
        UPDATE companies 
        SET name = $1, contact_email = $2, contact_phone = $3, status = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;

      const result = await query(updateCompanyQuery, [name, contact_email, contact_phone, status, id]);
      const updatedCompany = result.rows[0];

      res.json({
        message: 'Company updated successfully',
        company: updatedCompany
      });
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
);

// ============ USER MANAGEMENT ============

// Get all users (with role-based filtering)
router.get('/users', authenticateToken, requireRole(['platform_admin', 'company_admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, company_id, search } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE u.is_active = true';
    let queryParams = [];
    let paramIndex = 1;

    // Platform admin can filter by company, company admin only sees their company
    if (req.user.role === 'platform_admin') {
      if (company_id) {
        whereClause += ` AND u.company_id = $${paramIndex}`;
        queryParams.push(company_id);
        paramIndex++;
      }
    } else {
      // Company admin only sees their company users
      whereClause += ` AND u.company_id = $${paramIndex}`;
      queryParams.push(req.user.company_id);
      paramIndex++;
    }

    if (role) {
      whereClause += ` AND u.role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const usersQuery = `
      SELECT 
        u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
        c.name as company_name, c.company_code
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM users u ${whereClause}
    `;

    queryParams.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      query(usersQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users: usersResult.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🔍 Test endpoint HIT!');
  res.json({ message: 'Backend is working!', timestamp: new Date() });
});

// Simple POST test endpoint
router.post('/test', (req, res) => {
  console.log('🔍 POST test endpoint HIT!');
  console.log('🔍 POST test body:', req.body);
  res.json({ message: 'POST test working!', received: req.body });
});

// Debug route before users route
router.post('/users-debug', (req, res) => {
  console.log('🔍 Users debug route HIT!');
  console.log('🔍 Users debug body:', req.body);
  res.json({ message: 'Users debug working!', received: req.body });
});

// Catch-all route to debug all requests
router.all('*', (req, res, next) => {
  console.log('🔍 CATCH-ALL - Method:', req.method, 'Path:', req.originalUrl);
  console.log('🔍 CATCH-ALL - Body:', req.body);
  next();
});

// Create user (platform admin and company admin for employees)
router.post('/users', 
  authenticateToken, 
  requireRole(['platform_admin', 'company_admin']), 
  async (req, res) => {
    console.log('🔍 POST /users endpoint HIT! (WITH AUTH)');
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request body:', req.body);
    console.log('🔍 Auth user:', req.user);
    
    try {
      console.log('🔍 Create user request body:', req.body);
      console.log('🔍 Create user req.user:', req.user);
      
      const { full_name, email, phone, mobile, role, company_id, password } = req.body;
      
      console.log('🔍 Parsed data:', { full_name, email, phone, mobile, role, company_id, hasPassword: !!password });

      // Validation
      if (!full_name || !email || !role || !password) {
        console.log('🔍 Validation failed - missing required fields');
        return res.status(400).json({ error: 'Full name, email, role, and password are required' });
      }

      // Check if email already exists
      const existingEmailQuery = 'SELECT id FROM users WHERE email = $1';
      const existingEmail = await query(existingEmailQuery, [email]);
      
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // For company_admin: ignore company_id from request and use req.user.company_id
      let finalCompanyId = company_id;
      let finalRole = role;
      
      if (req.user.role === 'company_admin') {
        // Company admins can only create employees
        if (role !== 'employee') {
          return res.status(403).json({ error: 'Company admins can only create employees' });
        }
        
        // Always use the company admin's company_id, ignore what's sent in request
        finalCompanyId = req.user.company_id;
        finalRole = 'employee';
        
        console.log('🔍 Company admin creating employee - using company_id:', finalCompanyId);
      }

      // Hash password
      const bcrypt = require('bcrypt');
      const password_hash = await bcrypt.hash(password, 10);

      // Create user - handle phone/mobile mapping properly
      console.log('🔍 About to execute database query');
      const createUserQuery = `
        INSERT INTO users (full_name, email, phone, role, company_id, password_hash, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, full_name, email, phone, role, company_id, is_active, created_at
      `;

      // Handle phone field - use mobile if phone is not provided
      const queryParams = [
        full_name, 
        email, 
        mobile || phone || null,  // Use mobile first, then phone, then null
        finalRole, 
        finalCompanyId || null, 
        password_hash
      ];
      
      console.log('🔍 Query parameters:', queryParams);
      console.log('🔍 Executing query...');
      
      const result = await query(createUserQuery, queryParams);
      
      console.log('🔍 Query successful, result:', result.rows[0]);
      const newUser = result.rows[0];

      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      console.error('🔍 Create user error:', error);
      console.error('🔍 Error stack:', error.stack);
      
      // Handle specific error types
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(400).json({ error: 'Email already exists' });
      }
      
      if (error.code === '23503') { // PostgreSQL foreign key constraint violation
        return res.status(400).json({ error: 'Invalid company ID' });
      }
      
      if (error.code === '23502') { // PostgreSQL not null constraint violation
        return res.status(400).json({ error: 'Missing required field' });
      }
      
      // Generic error
      res.status(500).json({ 
        error: 'Failed to create user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Update user (platform admin and company admin for their own employees)
router.put('/users/:id', 
  authenticateToken, 
  requireRole(['platform_admin', 'company_admin']), 
  validateRequest(updateUserSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { full_name, email, phone, role, company_id } = req.body;
      const currentUser = req.user;

      // Check if user exists
      const existingUserQuery = 'SELECT id, company_id, role FROM users WHERE id = $1';
      const existingUser = await query(existingUserQuery, [id]);
      
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userToUpdate = existingUser.rows[0];

      // If current user is company admin, check if they can update this user
      if (currentUser.role === 'company_admin') {
        // Company admin can only update their own employees
        if (userToUpdate.company_id !== currentUser.company_id) {
          return res.status(403).json({ error: 'You can only update employees from your own company' });
        }
        // Company admin cannot change role or company_id
        if (role && role !== 'employee') {
          return res.status(403).json({ error: 'Company admin can only assign employee role' });
        }
        if (company_id && company_id !== currentUser.company_id) {
          return res.status(403).json({ error: 'Company admin cannot change company' });
        }
      }

      // Check if email already exists (excluding current user)
      if (email) {
        const emailCheckQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
        const emailCheck = await query(emailCheckQuery, [email, id]);
        
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      // Update user
      const updateUserQuery = `
        UPDATE users 
        SET full_name = COALESCE($1, full_name), 
            email = COALESCE($2, email), 
            phone = COALESCE($3, phone), 
            role = COALESCE($4, role), 
            company_id = COALESCE($5, company_id),
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, full_name, email, phone, role, company_id, is_active, created_at, updated_at
      `;

      const result = await query(updateUserQuery, [
        full_name, email, phone, role, company_id, id
      ]);
      
      const updatedUser = result.rows[0];

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Deactivate user (platform admin only)
router.put('/users/:id/deactivate', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deactivating yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Check if user exists
    const existingUserQuery = 'SELECT id, role FROM users WHERE id = $1';
    const existingUser = await query(existingUserQuery, [id]);
    
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deactivate user
    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// ============ DASHBOARD ANALYTICS ============

// Get platform overview (platform admin only)
router.get('/dashboard/overview', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const [
      companiesResult,
      usersResult,
      visitorsResult,
      leadsResult,
      recentActivityResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'active\' THEN 1 END) as active FROM companies'),
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN role = \'platform_admin\' THEN 1 END) as platform_admins, COUNT(CASE WHEN role = \'company_admin\' THEN 1 END) as company_admins, COUNT(CASE WHEN role = \'employee\' THEN 1 END) as employees FROM users WHERE is_active = true'),
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL \'30 days\' THEN 1 END) as last_30_days FROM visitors'),
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL \'30 days\' THEN 1 END) as last_30_days, COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today FROM visitor_leads'),
      query(`
        SELECT 
          'leads' as type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM visitor_leads 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        UNION ALL
        SELECT 
          'visitors' as type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM visitors 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC, type
      `)
    ]);

    const stats = {
      companies: companiesResult.rows[0],
      users: usersResult.rows[0],
      visitors: visitorsResult.rows[0],
      leads: leadsResult.rows[0],
      recent_activity: recentActivityResult.rows
    };

    res.json(stats);
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get company dashboard (company admin)
router.get('/dashboard/company', authenticateToken, requireRole(['company_admin', 'platform_admin']), async (req, res) => {
  try {
    let companyId;
    if (req.user.role === 'platform_admin') {
      companyId = req.query.company_id;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required for platform admin' });
      }
    } else {
      companyId = req.user.company_id;
    }

    const [
      companyResult,
      usersResult,
      leadsResult,
      employeeStatsResult,
      recentLeadsResult
    ] = await Promise.all([
      query('SELECT * FROM companies WHERE id = $1', [companyId]),
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN role = \'employee\' THEN 1 END) as employees FROM users WHERE company_id = $1 AND is_active = true', [companyId]),
      query('SELECT COUNT(*) as total, COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL \'30 days\' THEN 1 END) as last_30_days, COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today FROM visitor_leads WHERE company_id = $1', [companyId]),
      query(`
        SELECT 
          u.full_name,
          u.email,
          COUNT(vl.id) as leads_count,
          COUNT(CASE WHEN vl.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as leads_last_7_days
        FROM users u
        LEFT JOIN visitor_leads vl ON u.id = vl.employee_id
        WHERE u.company_id = $1 AND u.role = 'employee' AND u.is_active = true
        GROUP BY u.id, u.full_name, u.email
        ORDER BY leads_count DESC
      `, [companyId]),
      query(`
        SELECT 
          vl.id,
          vl.created_at,
          v.full_name as visitor_name,
          v.phone as visitor_phone,
          u.full_name as employee_name
        FROM visitor_leads vl
        JOIN visitors v ON vl.visitor_id = v.id
        JOIN users u ON vl.employee_id = u.id
        WHERE vl.company_id = $1
        ORDER BY vl.created_at DESC
        LIMIT 10
      `, [companyId])
    ]);

    const dashboard = {
      company: companyResult.rows[0],
      users: usersResult.rows[0],
      leads: leadsResult.rows[0],
      employee_stats: employeeStatsResult.rows,
      recent_leads: recentLeadsResult.rows
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Company dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch company dashboard' });
  }
});

// Get employee dashboard (employee)
router.get('/dashboard/employee', authenticateToken, requireRole(['employee']), async (req, res) => {
  try {
    const [
      employeeStatsResult,
      recentLeadsResult,
      followUpResult
    ] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as leads_last_30_days,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as leads_last_7_days,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as leads_today,
          COUNT(CASE WHEN follow_up_date IS NOT NULL THEN 1 END) as leads_with_follow_up,
          COUNT(CASE WHEN follow_up_date >= CURRENT_DATE THEN 1 END) as pending_follow_ups
        FROM visitor_leads 
        WHERE employee_id = $1
      `, [req.user.id]),
      query(`
        SELECT 
          vl.*,
          v.full_name as visitor_name,
          v.phone as visitor_phone
        FROM visitor_leads vl
        JOIN visitors v ON vl.visitor_id = v.id
        WHERE vl.employee_id = $1
        ORDER BY vl.created_at DESC
        LIMIT 10
      `, [req.user.id]),
      query(`
        SELECT 
          vl.*,
          v.full_name as visitor_name,
          v.phone as visitor_phone
        FROM visitor_leads vl
        JOIN visitors v ON vl.visitor_id = v.id
        WHERE vl.employee_id = $1 AND vl.follow_up_date >= CURRENT_DATE
        ORDER BY vl.follow_up_date ASC
        LIMIT 10
      `, [req.user.id])
    ]);

    const dashboard = {
      stats: employeeStatsResult.rows[0],
      recent_leads: recentLeadsResult.rows,
      pending_follow_ups: followUpResult.rows
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch employee dashboard' });
  }
});

// ============ COMPANY ADMIN MANAGEMENT ============

// Get all company admins (platform admin only)
router.get('/company-admins', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE u.role = $1';
    let queryParams = ['company_admin'];
    let paramIndex = 2;

    if (search) {
      whereClause += ' AND (u.full_name ILIKE $2 OR u.email ILIKE $3 OR u.mobile ILIKE $4)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (status) {
      const statusClause = status === 'active' ? 'u.is_active = true' : 'u.is_active = false';
      whereClause += ` AND ${statusClause}`;
    }

    const adminsQuery = `
      SELECT 
        u.*,
        c.name as company_name,
        c.company_code
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Add limit and offset to queryParams
    queryParams.push(limit, offset);

    const adminsResult = await query(adminsQuery, queryParams);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE u.role = $1
    `;

    const countResult = await query(countQuery, ['company_admin']);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: adminsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get company admins error:', error);
    res.status(500).json({ error: 'Failed to fetch company admins' });
  }
});

// Delete employee (company admin only)
router.delete('/employees/:id', authenticateToken, requireRole(['company_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    // Check if employee exists and belongs to the same company
    const existingEmployeeQuery = 'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role = \'employee\'';
    const existingEmployee = await query(existingEmployeeQuery, [id, companyId]);
    
    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or you do not have permission to delete this employee' });
    }

    // Soft delete employee by setting is_active to false
    const deleteEmployeeQuery = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND company_id = $2 AND role = 'employee'
      RETURNING id, full_name, email
    `;

    const result = await query(deleteEmployeeQuery, [id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      message: 'Employee deleted successfully',
      employee: result.rows[0],
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Create company admin (platform admin only)
router.post('/company-admins', authenticateToken, requireRole(['platform_admin']), validateRequest(createCompanyAdminSchema), async (req, res) => {
  try {
    const { full_name, email, mobile, password, company_id } = req.body;

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const createAdminQuery = `
      INSERT INTO users (full_name, email, mobile, password_hash, role, company_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, full_name, email, mobile, role, company_id, is_active, created_at
    `;

    const result = await query(createAdminQuery, [
      full_name,
      email,
      mobile,
      password_hash,
      'company_admin',
      company_id,
    ]);

    res.status(201).json({
      message: 'Company admin created successfully',
      admin: result.rows[0],
    });
  } catch (error) {
    console.error('Create company admin error:', error);
    res.status(500).json({ error: 'Failed to create company admin' });
  }
});

// Update company admin (platform admin only)
router.put('/company-admins/:id', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, mobile, is_active } = req.body;

    const updateAdminQuery = `
      UPDATE users 
      SET full_name = $1, email = $2, mobile = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND role = 'company_admin'
      RETURNING id, full_name, email, mobile, role, company_id, is_active, updated_at
    `;

    const result = await query(updateAdminQuery, [
      full_name,
      email,
      mobile,
      is_active,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company admin not found' });
    }

    res.json({
      message: 'Company admin updated successfully',
      admin: result.rows[0],
    });
  } catch (error) {
    console.error('Update company admin error:', error);
    res.status(500).json({ error: 'Failed to update company admin' });
  }
});

// Delete company admin (platform admin only)
router.delete('/company-admins/:id', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const deleteAdminQuery = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND role = 'company_admin'
      RETURNING id, full_name, email
    `;

    const result = await query(deleteAdminQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company admin not found' });
    }

    res.json({
      message: 'Company admin deleted successfully',
      admin: result.rows[0],
    });
  } catch (error) {
    console.error('Delete company admin error:', error);
    res.status(500).json({ error: 'Failed to delete company admin' });
  }
});

module.exports = router;
