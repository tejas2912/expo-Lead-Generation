const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, createVisitorSchema } = require('../middleware/validation');

const router = express.Router();

// Search visitor by phone number (for mobile app)
router.get('/search/:phone', authenticateToken, async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone || phone.length < 3) {
      return res.status(400).json({ error: 'Phone number must be at least 3 digits' });
    }

    const searchQuery = `
      SELECT id, phone, full_name, email, organization, designation, city, country, created_at, updated_at
      FROM visitors 
      WHERE phone ILIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await query(searchQuery, [`%${phone}%`]);
    
    res.json({
      visitors: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Visitor search error:', error);
    res.status(500).json({ error: 'Failed to search visitors' });
  }
});

// Get visitor by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const visitorQuery = `
      SELECT id, phone, full_name, email, organization, designation, city, country, created_at, updated_at
      FROM visitors 
      WHERE id = $1
    `;
    
    const result = await query(visitorQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    
    res.json({ visitor: result.rows[0] });
  } catch (error) {
    console.error('Get visitor error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor' });
  }
});

// Create new visitor
router.post('/', 
  authenticateToken, 
  validateRequest(createVisitorSchema), 
  async (req, res) => {
    try {
      const { phone, full_name, email, organization, designation, city, country, interests } = req.body;

      // Check if visitor with this phone already exists
      const existingVisitorQuery = 'SELECT id FROM visitors WHERE phone = $1';
      const existingVisitor = await query(existingVisitorQuery, [phone]);
      
      if (existingVisitor.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Visitor with this phone number already exists',
          visitor_id: existingVisitor.rows[0].id
        });
      }

      // Create new visitor
      const insertVisitorQuery = `
        INSERT INTO visitors (phone, full_name, email, organization, designation, city, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, phone, full_name, email, organization, designation, city, country, created_at
      `;

      const result = await query(insertVisitorQuery, [
        phone, full_name, email || null, organization || null, 
        designation || null, city || null, country || null
      ]);

      const newVisitor = result.rows[0];

      res.status(201).json({
        message: 'Visitor created successfully',
        visitor: newVisitor
      });
    } catch (error) {
      console.error('Create visitor error:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({ 
          error: 'Visitor with this phone number already exists' 
        });
      }
      
      res.status(500).json({ error: 'Failed to create visitor' });
    }
  }
);

// Update visitor information
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, organization, designation, city, country } = req.body;

    // Check if visitor exists
    const existingVisitorQuery = 'SELECT id FROM visitors WHERE id = $1';
    const existingVisitor = await query(existingVisitorQuery, [id]);
    
    if (existingVisitor.rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Update visitor
    const updateVisitorQuery = `
      UPDATE visitors 
      SET full_name = $1, email = $2, organization = $3, designation = $4, city = $5, country = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING id, phone, full_name, email, organization, designation, city, country, updated_at
    `;

    const result = await query(updateVisitorQuery, [
      full_name, email, organization, designation, city, country, id
    ]);

    const updatedVisitor = result.rows[0];

    res.json({
      message: 'Visitor updated successfully',
      visitor: updatedVisitor
    });
  } catch (error) {
    console.error('Update visitor error:', error);
    res.status(500).json({ error: 'Failed to update visitor' });
  }
});

// Get all visitors (Platform Admin only)
router.get('/', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    // Add search functionality
    if (search) {
      whereClause = `WHERE phone ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const visitorsQuery = `
      SELECT id, phone, full_name, email, organization, designation, city, country, created_at, updated_at
      FROM visitors 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM visitors 
      ${whereClause}
    `;

    const [visitorsResult, countResult] = await Promise.all([
      query(visitorsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      visitors: visitorsResult.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

// Get visitor statistics (Platform Admin only)
router.get('/stats/overview', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_visitors,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as visitors_last_30_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as visitors_last_7_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as visitors_today
      FROM visitors 
    `;

    const result = await query(statsQuery);
    const stats = result.rows[0];

    res.json({
      total_visitors: parseInt(stats.total_visitors),
      visitors_last_30_days: parseInt(stats.visitors_last_30_days),
      visitors_last_7_days: parseInt(stats.visitors_last_7_days),
      visitors_today: parseInt(stats.visitors_today)
    });
  } catch (error) {
    console.error('Visitor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor statistics' });
  }
});

// Delete visitor (Platform Admin only)
router.delete('/:id', authenticateToken, requireRole(['platform_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if visitor exists
    const existingVisitorQuery = 'SELECT id FROM visitors WHERE id = $1';
    const existingVisitor = await query(existingVisitorQuery, [id]);
    
    if (existingVisitor.rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Delete visitor
    const deleteVisitorQuery = 'DELETE FROM visitors WHERE id = $1 RETURNING id';
    const result = await query(deleteVisitorQuery, [id]);

    res.json({
      message: 'Visitor deleted successfully',
      visitor_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Delete visitor error:', error);
    res.status(500).json({ error: 'Failed to delete visitor' });
  }
});

module.exports = router;
