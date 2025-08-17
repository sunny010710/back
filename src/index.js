// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter    = require('./routes/auth');
const citybusRouter = require('./routes/citybus');

const app = express();
app.use(cors());
app.use(express.json());

// (선택) health-check용 엔드포인트
app.get('/', (req, res) => res.send('OK'));

// 기존 /auth 라우트
app.use('/auth', authRouter);

// bus 관련 API는 /api/bus 아래에 모으기
app.use('/api/bus', citybusRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
