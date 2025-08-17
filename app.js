const express = require('express');
const cors = require('cors');
require('dotenv').config();       // .env 사용
const userRoutes = require('./routes/users');
const citybusRouter = require('./src/routes/citybus');

const app = express();

app.use(cors({ origin: '*' }));   // 개발용: 모든 도메인 허용
app.use(express.json());          // JSON 바디 파싱

app.use('/api/users', userRoutes);
app.use('/api/bus', citybusRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
