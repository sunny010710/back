// your-backend-project/routes/users.js

const router = require('express').Router();
const db = require('../db');      // db.js에서 내보낸 pool

// 회원가입
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [result] = await db.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, password]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT id FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    if (rows.length) {
      res.json({ id: rows[0].id });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
