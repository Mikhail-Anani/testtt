import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { pgPool } from '../db/connections';
import { getRedisClient } from '../db/connections';
import { getNeo4jSession } from '../db/connections';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);
router.post('/games',
  [
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim(),
    body('genre').optional().trim(),
    body('platform').optional().trim(),
    body('releaseDate').optional().isISO8601(),
    body('imageUrl').optional().custom((value) => {
      if (!value || value === null || value === '') return true;
      if (value.startsWith('data:')) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    }),
    body('trailerUrl').optional().custom((value) => {
      if (!value || value === null || value === '') return true;
      if (value.includes('youtube.com') || value.includes('youtu.be')) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    }),
    body('gameMode').optional().isIn(['solo', 'multiplayer', 'both']),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, genre, platform, releaseDate, imageUrl, trailerUrl, gameMode } = req.body;
      const createdBy = req.userId!;

      if (imageUrl?.startsWith('data:') && imageUrl.length > 5000000) {
        return res.status(400).json({ error: 'Image trop grande (max 5MB)' });
      }

      let finalTrailerUrl = trailerUrl || null;
      if (finalTrailerUrl && typeof finalTrailerUrl === 'string') {
        if (finalTrailerUrl.includes('youtube.com/watch?v=')) {
          const videoId = finalTrailerUrl.split('v=')[1]?.split('&')[0];
          if (videoId) {
            finalTrailerUrl = `https://www.youtube.com/embed/${videoId}`;
          }
        } else if (finalTrailerUrl.includes('youtu.be/')) {
          const videoId = finalTrailerUrl.split('youtu.be/')[1]?.split('?')[0];
          if (videoId) {
            finalTrailerUrl = `https://www.youtube.com/embed/${videoId}`;
          }
        }
      }

      const result = await pgPool.query(
        `INSERT INTO games (title, description, genre, platform, release_date, image_url, trailer_url, game_mode, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, description || null, genre || null, platform || null, releaseDate || null, imageUrl || null, finalTrailerUrl, gameMode || 'solo', createdBy]
      );

      const game = result.rows[0];

      try {
        const session = await getNeo4jSession();
        if (session) {
          await session.run(`
            MERGE (g:Game {id: $id})
            SET g.title = $title, g.genre = $genre
          `, { id: game.id, title: game.title, genre: game.genre || '' });
        }
      } catch (error) {
        console.warn('Neo4j operation failed:', error);
      }

      const redis = await getRedisClient();
      await redis.del('games:all');

      res.status(201).json(game);
    } catch (error) {
      console.error('Create game error:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  }
);

router.put('/games/:id',
  [
    body('title').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim(),
    body('genre').optional().trim(),
    body('platform').optional().trim(),
    body('releaseDate').optional().isISO8601(),
    body('imageUrl').optional().custom((value) => {
      if (!value || value === null || value === '') return true;
      if (value.startsWith('data:')) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    }),
    body('trailerUrl').optional().custom((value) => {
      if (!value || value === null || value === '') return true;
      if (value.includes('youtube.com') || value.includes('youtu.be')) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    }),
    body('gameMode').optional().isIn(['solo', 'multiplayer', 'both']),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { title, description, genre, platform, releaseDate, imageUrl, trailerUrl, gameMode } = req.body;

      if (imageUrl?.startsWith('data:') && imageUrl.length > 5000000) {
        return res.status(400).json({ error: 'Image trop grande (max 5MB)' });
      }
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description || null);
      }
      if (genre !== undefined) {
        updates.push(`genre = $${paramCount++}`);
        values.push(genre || null);
      }
      if (platform !== undefined) {
        updates.push(`platform = $${paramCount++}`);
        values.push(platform || null);
      }
      if (releaseDate !== undefined) {
        updates.push(`release_date = $${paramCount++}`);
        values.push(releaseDate || null);
      }
      if (imageUrl !== undefined) {
        updates.push(`image_url = $${paramCount++}`);
        values.push(imageUrl || null);
      }
      if (trailerUrl !== undefined) {
        let finalTrailerUrl = trailerUrl;
        if (finalTrailerUrl && typeof finalTrailerUrl === 'string') {
          if (finalTrailerUrl.includes('youtube.com/watch?v=')) {
            const videoId = finalTrailerUrl.split('v=')[1]?.split('&')[0];
            if (videoId) {
              finalTrailerUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          } else if (finalTrailerUrl.includes('youtu.be/')) {
            const videoId = finalTrailerUrl.split('youtu.be/')[1]?.split('?')[0];
            if (videoId) {
              finalTrailerUrl = `https://www.youtube.com/embed/${videoId}`;
            }
          }
        }
        updates.push(`trailer_url = $${paramCount++}`);
        values.push(finalTrailerUrl || null);
      }
      if (gameMode !== undefined) {
        updates.push(`game_mode = $${paramCount++}`);
        values.push(gameMode || 'solo');
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(id));

      const result = await pgPool.query(
        `UPDATE games SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = result.rows[0];

      try {
        const session = await getNeo4jSession();
        if (session) {
          await session.run(`
            MATCH (g:Game {id: $id})
            SET g.title = $title, g.genre = $genre
          `, { id: game.id, title: game.title, genre: game.genre || '' });
        }
      } catch (error) {
        console.warn('Neo4j operation failed:', error);
      }

      const redis = await getRedisClient();
      await redis.del(`games:${id}`);
      await redis.del('games:all');

      res.json(game);
    } catch (error) {
      console.error('Update game error:', error);
      res.status(500).json({ error: 'Failed to update game' });
    }
  }
);

router.delete('/games/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pgPool.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    try {
      const session = await getNeo4jSession();
      if (session) {
        await session.run('MATCH (g:Game {id: $id}) DETACH DELETE g', { id: parseInt(id) });
      }
    } catch (error) {
      console.warn('Neo4j operation failed:', error);
    }

    const redis = await getRedisClient();
    await redis.del(`games:${id}`);
    await redis.del('games:all');

    res.json({ message: 'Game deleted' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

export default router;

