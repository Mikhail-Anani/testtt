import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDatabases } from './db/connections';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import ratingRoutes from './routes/ratings';
import commentRoutes from './routes/comments';
import userGameRoutes from './routes/userGames';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/', rateLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/user-games', userGameRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);
initDatabases()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Databases initialized`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize databases:', error);
    process.exit(1);
  });

