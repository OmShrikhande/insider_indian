const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { client } = require('../config/database');

const router = express.Router();

const generateToken = (id, username, role) => {
  return jwt.sign({ id, username, role }, process.env.JWT_SECRET || 'roxey_super_secret_jwt_key', {
    expiresIn: '30d',
  });
};

const resolveRole = (username) => {
  const admins = String(process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(username).toLowerCase()) ? 'admin' : 'analyst';
};

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Please provide username and password' });
    }

    // Check if user exists
    const existing = await client.query({
      query: `SELECT id FROM users WHERE username = {username:String} LIMIT 1`,
      query_params: { username },
      format: 'JSONEachRow'
    });
    const existingData = await existing.json();

    if (existingData.length > 0) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = uuidv4();
    const role = resolveRole(username);

    await client.insert({
      table: 'users',
      values: [{ id: userId, username, password_hash: hashedPassword, role, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }],
      format: 'JSONEachRow'
    });

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        username,
        role,
        token: generateToken(userId, username, role)
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server configuration error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await client.query({
      query: `SELECT id, username, password_hash, role FROM users WHERE username = {username:String} LIMIT 1`,
      query_params: { username },
      format: 'JSONEachRow'
    });
    const users = await result.json();

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role || 'analyst',
        token: generateToken(user.id, user.username, user.role || 'analyst')
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
