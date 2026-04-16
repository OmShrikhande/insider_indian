const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { client } = require('../config/database');

const router = express.Router();

const generateToken = (id, username) => {
  return jwt.sign({ id, username }, process.env.JWT_SECRET || 'roxey_super_secret_jwt_key', {
    expiresIn: '30d',
  });
};

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Please provide username and password' });
    }

    // Check if user exists
    const existing = await client.query({
      query: `SELECT id FROM users WHERE username = '${username}' LIMIT 1`,
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

    await client.insert({
      table: 'users',
      values: [{ id: userId, username, password_hash: hashedPassword, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }],
      format: 'JSONEachRow'
    });

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        username,
        token: generateToken(userId, username)
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
      query: `SELECT id, username, password_hash FROM users WHERE username = '${username}' LIMIT 1`,
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
        token: generateToken(user.id, user.username)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
