import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getMongoDb } from '../db/connections';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/my-list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const db = await getMongoDb();
    const userGame = await db.collection('user_games').findOne({ userId });

    if (!userGame) {
      return res.json({ games: [] });
    }

    res.json({ games: userGame.games || [] });
  } catch (error) {
    console.error('Get user games error:', error);
    res.status(500).json({ error: 'Failed to fetch user games' });
  }
});

router.post('/add',
  authenticate,
  [
    body('gameId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { gameId } = req.body;
      const userId = req.userId!;

      const db = await getMongoDb();
      const gameIdInt = parseInt(gameId);

      let userGame = await db.collection('user_games').findOne({ userId });

      if (!userGame) {
        userGame = {
          userId,
          games: [gameIdInt],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.collection('user_games').insertOne(userGame);
      } else {
        if (!userGame.games.includes(gameIdInt)) {
          await db.collection('user_games').updateOne(
            { userId },
            {
              $push: { games: gameIdInt },
              $set: { updatedAt: new Date() }
            }
          );
        }
      }

      const updated = await db.collection('user_games').findOne({ userId });
      res.json({ games: updated.games });
    } catch (error) {
      console.error('Add game to list error:', error);
      res.status(500).json({ error: 'Failed to add game to list' });
    }
  }
);

router.post('/remove',
  authenticate,
  [
    body('gameId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { gameId } = req.body;
      const userId = req.userId!;

      const db = await getMongoDb();
      const gameIdInt = parseInt(gameId);

      await db.collection('user_games').updateOne(
        { userId },
        {
          $pull: { games: gameIdInt },
          $set: { updatedAt: new Date() }
        }
      );

      const updated = await db.collection('user_games').findOne({ userId });
      res.json({ games: updated?.games || [] });
    } catch (error) {
      console.error('Remove game from list error:', error);
      res.status(500).json({ error: 'Failed to remove game from list' });
    }
  }
);

export default router;

