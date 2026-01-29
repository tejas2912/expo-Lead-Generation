const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, loginSchema, registerUserSchema } = require('../middleware/validation');

const router = express.Router();

// Login endpoint
router.post('/login', validateRequest(loginSchema), async (req, res) => {
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
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register new user (only platform admin can create users)
router.post('/register', 
  authenticateToken, 
  requireRole(['platform_admin']), 
  validateRequest(registerUserSchema), 
  async (req, res) => {
    try {
      const { email, password, full_name, phone, role, company_id } = req.body;

      // Check if email already exists
      const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
      const existingUser = await query(existingUserQuery, [email]);
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // If role is not platform_admin, validate company exists
      if (role !== 'platform_admin') {
        const companyQuery = 'SELECT id FROM companies WHERE id = $1';
        const companyResult = await query(companyQuery, [company_id]);
        
        if (companyResult.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid company ID' });
        }
      }

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Insert new user
      const insertUserQuery = `
        INSERT INTO users (email, password_hash, full_name, phone, role, company_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, full_name, phone, role, company_id, is_active, created_at
      `;

      const newUserResult = await query(insertUserQuery, [
        email, password_hash, full_name, phone, role, 
        role === 'platform_admin' ? null : company_id
      ]);

      const newUser = newUserResult.rows[0];

      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { password_hash, ...userProfile } = req.user;
    res.json({ user: userProfile });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
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
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, req.user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
