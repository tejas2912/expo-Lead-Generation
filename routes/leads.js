const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireCompanyAccess } = require('../middleware/auth');
const { validateRequest, createLeadSchema, updateLeadSchema } = require('../middleware/validation');

const router = express.Router();

// Create new lead (for employees)
router.post('/', 
  authenticateToken, 
  requireRole(['employee', 'company_admin', 'platform_admin']), 
  validateRequest(createLeadSchema), 
  async (req, res) => {
    try {
      const { 
        visitor_id, // Optional - if not provided, create new visitor
        phone, // Required if visitor_id not provided
        full_name, // Required if visitor_id not provided
        email, // Optional if visitor_id not provided
        organization, // Optional if visitor_id not provided
        designation, // Optional if visitor_id not provided
        city, // Optional if visitor_id not provided
        country, // Optional if visitor_id not provided
        interests, // Optional if visitor_id not provided - visitor-level
        notes, // Lead-specific
        follow_up_date, // Lead-specific
        // priority, // Temporarily removed - DB column doesn't exist
        // tags // Temporarily removed - DB column doesn't exist
      } = req.body;

      // Determine company_id based on user role
      let company_id;
      if (req.user.role === 'platform_admin') {
        company_id = req.body.company_id; // Platform admin must specify company
        if (!company_id) {
          return res.status(400).json({ error: 'Company ID required for platform admin' });
        }
      } else {
        company_id = req.user.company_id; // Use user's company
      }

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
        // Case 2: New visitor - create first
        if (!phone || !full_name) {
          return res.status(400).json({ 
            error: 'Phone and full_name are required when visitor_id is not provided' 
          });
        }

        // Check if visitor with this phone already exists
        const existingVisitorQuery = 'SELECT id FROM visitors WHERE phone = $1';
        const existingVisitor = await query(existingVisitorQuery, [phone]);
        
        if (existingVisitor.rows.length > 0) {
          // Use existing visitor
          finalVisitorId = existingVisitor.rows[0].id;
          
          // Get visitor details for response
          const visitorQuery = 'SELECT id, phone, full_name FROM visitors WHERE id = $1';
          visitorResult = await query(visitorQuery, [finalVisitorId]);
        } else {
          // Create new visitor
          const insertVisitorQuery = `
            INSERT INTO visitors (phone, full_name, email, organization, designation, city, country)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, phone, full_name
          `;

          const newVisitorResult = await query(insertVisitorQuery, [
            phone, full_name, email || null, organization || null, 
            designation || null, city || null, country || null
          ]);

          visitorResult = newVisitorResult;
          finalVisitorId = newVisitorResult.rows[0].id;
        }
      }

      // Check for duplicate lead (same visitor, same company, same day)
      const duplicateLeadQuery = `
        SELECT id FROM visitor_leads 
        WHERE visitor_id = $1 AND company_id = $2 AND DATE(created_at) = CURRENT_DATE
      `;
      const duplicateLead = await query(duplicateLeadQuery, [finalVisitorId, company_id]);
      
      if (duplicateLead.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Lead already exists for this visitor today',
          existing_lead_id: duplicateLead.rows[0].id
        });
      }

      // Get visitor details for response and lead data
      const visitorQuery = 'SELECT * FROM visitors WHERE id = $1';
      visitorResult = await query(visitorQuery, [finalVisitorId]);
      const visitorData = visitorResult.rows[0];

      // Create lead
      const insertLeadQuery = `
        INSERT INTO visitor_leads (
          company_id, visitor_id, employee_id, notes, follow_up_date,
          organization, designation, city, country, interests
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const leadResult = await query(insertLeadQuery, [
        company_id, finalVisitorId, req.user.id, notes || null, 
        follow_up_date || null, 
        visitorData?.organization || organization || null, 
        visitorData?.designation || designation || null, 
        visitorData?.city || city || null, 
        visitorData?.country || country || null,
        interests || null
      ]);

      const newLead = leadResult.rows[0];
      const visitor = visitorResult.rows[0];

      res.status(201).json({
        message: 'Lead created successfully',
        lead: {
          ...newLead,
          visitor: {
            id: visitor.id,
            phone: visitor.phone,
            full_name: visitor.full_name
          }
        }
      });
    } catch (error) {
      console.error('Create lead error:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }
);

// Get leads for the authenticated user's company
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      employee_id, 
      date_from, 
      date_to,
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;

    // Filter by company based on user role
    if (req.user.role === 'platform_admin') {
      // Platform admin can filter by company if specified
      if (req.query.company_id) {
        whereClause += ` AND vl.company_id = $${paramIndex}`;
        queryParams.push(req.query.company_id);
        paramIndex++;
      }
    } else {
      // Company admin and employee can only see their company's leads
      whereClause += ` AND vl.company_id = $${paramIndex}`;
      queryParams.push(req.user.company_id);
      paramIndex++;
    }

    // Employee can only see their own leads unless they're company admin
    if (req.user.role === 'employee') {
      whereClause += ` AND vl.employee_id = $${paramIndex}`;
      queryParams.push(req.user.id);
      paramIndex++;
    } else if (employee_id) {
      // Company admin can filter by employee
      whereClause += ` AND vl.employee_id = $${paramIndex}`;
      queryParams.push(employee_id);
      paramIndex++;
    }

    // Additional filters
    if (date_from) {
      whereClause += ` AND vl.created_at >= $${paramIndex}`;
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereClause += ` AND vl.created_at <= $${paramIndex}`;
      queryParams.push(date_to + ' 23:59:59');
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (v.phone ILIKE $${paramIndex} OR v.full_name ILIKE $${paramIndex} OR v.email ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const leadsQuery = `
      SELECT 
        vl.*,
        v.phone as visitor_phone,
        v.full_name as visitor_name,
        v.email as visitor_email,
        v.organization as visitor_organization,
        v.designation as visitor_designation,
        v.city as visitor_city,
        v.country as visitor_country,
        e.full_name as employee_name,
        e.email as employee_email,
        c.name as company_name
      FROM visitor_leads vl
      JOIN visitors v ON vl.visitor_id = v.id
      JOIN users e ON vl.employee_id = e.id
      JOIN companies c ON vl.company_id = c.id
      ${whereClause}
      ORDER BY vl.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM visitor_leads vl
      JOIN visitors v ON vl.visitor_id = v.id
      ${whereClause}
    `;

    queryParams.push(limit, offset);

    const [leadsResult, countResult] = await Promise.all([
      query(leadsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      leads: leadsResult.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get lead by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let whereClause = 'WHERE vl.id = $1';
    let queryParams = [id];
    let paramIndex = 2;

    // Apply company access restrictions
    if (req.user.role !== 'platform_admin') {
      whereClause += ` AND vl.company_id = $${paramIndex}`;
      queryParams.push(req.user.company_id);
      paramIndex++;
    }

    // Employee can only see their own leads
    if (req.user.role === 'employee') {
      whereClause += ` AND vl.employee_id = $${paramIndex}`;
      queryParams.push(req.user.id);
    }

    const leadQuery = `
      SELECT 
        vl.*,
        v.phone as visitor_phone,
        v.full_name as visitor_name,
        v.email as visitor_email,
        v.organization as visitor_organization,
        v.designation as visitor_designation,
        v.city as visitor_city,
        v.country as visitor_country,
        e.full_name as employee_name,
        e.email as employee_email,
        c.name as company_name
      FROM visitor_leads vl
      JOIN visitors v ON vl.visitor_id = v.id
      JOIN users e ON vl.employee_id = e.id
      JOIN companies c ON vl.company_id = c.id
      ${whereClause}
    `;

    const result = await query(leadQuery, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found or access denied' });
    }
    
    res.json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Update lead
router.put('/:id', 
  authenticateToken, 
  validateRequest(updateLeadSchema), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { interests, notes, follow_up_date } = req.body;

      // Check if lead exists and user has access
      let accessCheckQuery = 'SELECT company_id, employee_id FROM visitor_leads WHERE id = $1';
      const leadCheck = await query(accessCheckQuery, [id]);
      
      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const lead = leadCheck.rows[0];

      // Check access permissions
      if (req.user.role === 'employee' && lead.employee_id !== req.user.id) {
        return res.status(403).json({ error: 'Can only update your own leads' });
      }

      if (req.user.role === 'company_admin' && lead.company_id !== req.user.company_id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update lead
      const updateLeadQuery = `
        UPDATE visitor_leads 
        SET interests = $1, notes = $2, follow_up_date = $3
        WHERE id = $4
        RETURNING *
      `;

      const result = await query(updateLeadQuery, [interests, notes, follow_up_date, id]);
      const updatedLead = result.rows[0];

      res.json({
        message: 'Lead updated successfully',
        lead: updatedLead
      });
    } catch (error) {
      console.error('Update lead error:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }
);

// Delete lead (only for company admins and platform admin)
router.delete('/:id', authenticateToken, requireRole(['company_admin', 'platform_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if lead exists and user has access
    let accessCheckQuery = 'SELECT company_id FROM visitor_leads WHERE id = $1';
    const leadCheck = await query(accessCheckQuery, [id]);
    
    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leadCheck.rows[0];

    // Company admin can only delete their company's leads
    if (req.user.role === 'company_admin' && lead.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete lead
    await query('DELETE FROM visitor_leads WHERE id = $1', [id]);

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Get lead statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;

    // Filter by company based on user role
    if (req.user.role !== 'platform_admin') {
      whereClause += ` AND company_id = $${paramIndex}`;
      queryParams.push(req.user.company_id);
      paramIndex++;
    }

    // Employee can only see their own stats
    if (req.user.role === 'employee') {
      whereClause += ` AND employee_id = $${paramIndex}`;
      queryParams.push(req.user.id);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as leads_last_30_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as leads_last_7_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as leads_today,
        COUNT(CASE WHEN follow_up_date IS NOT NULL THEN 1 END) as leads_with_follow_up,
        COUNT(CASE WHEN follow_up_date >= CURRENT_DATE THEN 1 END) as pending_follow_ups
      FROM visitor_leads 
      ${whereClause}
    `;

    const result = await query(statsQuery, queryParams);
    const stats = result.rows[0];

    res.json({
      total_leads: parseInt(stats.total_leads),
      leads_last_30_days: parseInt(stats.leads_last_30_days),
      leads_last_7_days: parseInt(stats.leads_last_7_days),
      leads_today: parseInt(stats.leads_today),
      leads_with_follow_up: parseInt(stats.leads_with_follow_up),
      pending_follow_ups: parseInt(stats.pending_follow_ups)
    });
  } catch (error) {
    console.error('Lead stats error:', error);
    res.status(500).json({ error: 'Failed to fetch lead statistics' });
  }
});

module.exports = router;
