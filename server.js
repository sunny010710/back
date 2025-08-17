import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import response from './middlewares/response.js';
import errorHandler from './middlewares/error.js';
import routes from './routes/index.js';

const app = express();

// CORS (Flutter 웹 대비)
const allow = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(response); // res.ok / res.fail

app.get('/health', (req, res) => res.ok({ ts: Date.now() }));
app.use('/', routes);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening http://localhost:${port}`));
