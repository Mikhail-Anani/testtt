import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { pgPool } from '../db/connections';
import { getRedisClient } from '../db/connections';
import { getNeo4jSession } from '../db/connections';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/game/:gameId', async (req: express.Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const result = await pgPool.query(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.game_id = $1
      ORDER BY r.created_at DESC
    `, [gameId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

router.get('/game/:gameId/user', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    const result = await pgPool.query(
      'SELECT * FROM ratings WHERE game_id = $1 AND user_id = $2',
      [gameId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ rating: null });
    }

    res.json({ rating: result.rows[0] });
  } catch (error) {
    console.error('Get user rating error:', error);
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

router.post('/',
  authenticate,
  [
    body('gameId').isInt(),
    body('rating').isInt({ min: 1, max: 5 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { gameId, rating } = req.body;
      const userId = req.userId!;

      const gameCheck = await pgPool.query('SELECT id FROM games WHERE id = $1', [gameId]);
      if (gameCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const existing = await pgPool.query(
        'SELECT id FROM ratings WHERE game_id = $1 AND user_id = $2',
        [gameId, userId]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await pgPool.query(
          'UPDATE ratings SET rating = $1, created_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [rating, existing.rows[0].id]
        );
      } else {
        result = await pgPool.query(
          'INSERT INTO ratings (game_id, user_id, rating) VALUES ($1, $2, $3) RETURNING *',
          [gameId, userId, rating]
        );
      }

      const redis = await getRedisClient();
      await redis.del(`games:${gameId}`);
      await redis.del('games:all');
      try {
        const session = await getNeo4jSession();
        if (session) {
          await session.run(`
            MERGE (g:Game {id: $gameId})
            MERGE (u:User {id: $userId})
            MERGE (u)-[r:RATED]->(g)
            SET r.rating = $rating, r.timestamp = timestamp()
          `, { gameId: parseInt(gameId), userId, rating });

          await session.run(`
            MATCH (u:User {id: $userId})-[r1:RATED]->(g1:Game {id: $gameId})
            MATCH (u)-[r2:RATED]->(g2:Game)
            WHERE g1.id <> g2.id AND abs(r1.rating - r2.rating) <= 1
            MERGE (g1)-[rel:RELATED_TO]->(g2)
            ON CREATE SET rel.weight = 1
            ON MATCH SET rel.weight = rel.weight + 1
          `, { userId, gameId: parseInt(gameId) });
        }
      } catch (error) {
        console.warn('Neo4j operation failed:', error);
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Create rating error:', error);
      res.status(500).json({ error: 'Failed to create rating' });
    }
  }
);

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const check = await pgPool.query(
      'SELECT game_id FROM ratings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    const gameId = check.rows[0].game_id;

    await pgPool.query('DELETE FROM ratings WHERE id = $1', [id]);

    const redis = await getRedisClient();
    await redis.del(`games:${gameId}`);
    await redis.del('games:all');

    res.json({ message: 'Rating deleted' });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

export default router;

