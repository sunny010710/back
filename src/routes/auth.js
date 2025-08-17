const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../db');
const { isSchoolEmail } = require('../utils/validation');

// 이메일 발송 설정
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// 회원가입
router.post('/register', async (req, res) => {
  console.log('▶ Incoming name:', req.body.name);
  try {
    const { name, student_number, email, password } = req.body;

    // 필수 입력값 확인
    if (!name || !student_number || !email || !password) {
      return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    }

    // 학교 이메일 도메인 체크
    if (!isSchoolEmail(email)) {
      return res.status(400).json({ message: '건국대 글로컬캠퍼스 이메일만 사용 가능합니다.' });
    }

    // 중복 가입 체크
    const [exists] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?', [email]
    );
    if (exists.length) {
      return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
    }

    // 비밀번호 해싱
    const password_hash = await bcrypt.hash(password, 10);

    // 인증번호 생성 (6자리, 10분 유효)
    const verify_code = String(Math.floor(100000 + Math.random() * 900000));
    const code_expires = new Date(Date.now() + 10 * 60 * 1000);

    // 사용자 정보 저장
    await pool.query(
      `INSERT INTO users
         (name, student_number, email, password_hash, is_verified, verify_code, code_expires)
       VALUES (?, ?, ?, ?, FALSE, ?, ?)`,
      [name, student_number, email, password_hash, verify_code, code_expires]
    );

    // 인증 메일 발송
    await transporter.sendMail({
      from: `"캠퍼스앱" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '캠퍼스앱 이메일 인증번호 안내',
      html: `
        <p>안녕하세요, 캠퍼스앱입니다.</p>
        <p>회원가입을 위해 아래 <strong>6자리 인증번호</strong>를 입력해주세요. (10분 유효)</p>
        <h2 style="letter-spacing:4px;">${verify_code}</h2>
      `
    });

    res.status(201).json({ message: '인증번호를 이메일로 발송했습니다.' });
  } catch (err) {
    console.error('REGISTER ERROR ▶', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

// 인증번호 재전송
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    const [users] = await pool.query(
      'SELECT user_id, is_verified FROM users WHERE email = ?', [email]
    );
    if (!users.length) return res.status(404).json({ message: '등록되지 않은 이메일입니다.' });
    if (users[0].is_verified) return res.status(400).json({ message: '이미 인증된 이메일입니다.' });

    const verify_code = String(Math.floor(100000 + Math.random() * 900000));
    const code_expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verify_code = ?, code_expires = ? WHERE user_id = ?',
      [verify_code, code_expires, users[0].user_id]
    );

    await transporter.sendMail({
      from: `"캠퍼스앱" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '캠퍼스앱 인증번호 재전송 안내',
      html: `
        <p>안녕하세요, 캠퍼스앱입니다.</p>
        <p>요청하신 인증번호를 재전송합니다. (10분 유효)</p>
        <h2 style="letter-spacing:4px;">${verify_code}</h2>
      `
    });

    res.json({ message: '인증번호를 재전송했습니다.' });
  } catch (err) {
    console.error('RESEND CODE ERROR ▶', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

// 인증번호 검증
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const [rows] = await pool.query(
      'SELECT user_id, code_expires FROM users WHERE email = ? AND verify_code = ?',
      [email, code]
    );
    if (!rows.length) return res.status(400).json({ message: '인증번호가 일치하지 않습니다.' });
    if (rows[0].code_expires < new Date()) return res.status(400).json({ message: '인증번호가 만료되었습니다.' });

    await pool.query(
      `UPDATE users
         SET is_verified = TRUE, verify_code = NULL, code_expires = NULL
       WHERE user_id = ?`,
      [rows[0].user_id]
    );

    res.json({ message: '이메일 인증이 완료되었습니다.' });
  } catch (err) {
    console.error('VERIFY CODE ERROR ▶', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];
    if (!user) return res.status(401).json({ message: '등록되지 않은 이메일입니다.' });
    if (!user.is_verified) return res.status(403).json({ message: '이메일 인증이 필요합니다.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });

    const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('LOGIN ERROR ▶', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

module.exports = router;
