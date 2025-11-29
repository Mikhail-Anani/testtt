import express, { Request, Response } from 'express';
import { pgPool } from '../db/connections';
import { getRedisClient } from '../db/connections';
import { getNeo4jSession } from '../db/connections';

const router = express.Router();

router.get('/', async (req: express.Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const cacheKey = 'games:all';
    const skipCache = req.query.skipCache === 'true';
    
    let cached = null;
    if (!skipCache) {
      cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const result = await pgPool.query(`
      SELECT g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
             g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(DISTINCT r.id) as rating_count,
             u.name as created_by_name
      FROM games g
      LEFT JOIN ratings r ON g.id = r.game_id
      LEFT JOIN users u ON g.created_by = u.id
      GROUP BY g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
               g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at, u.name
      ORDER BY g.created_at DESC
    `);

    const games = result.rows.map(row => ({
      ...row,
      average_rating: parseFloat(row.average_rating) || 0,
      rating_count: parseInt(row.rating_count) || 0,
    }));

    if (!skipCache) {
      await redis.setEx(cacheKey, 300, JSON.stringify(games));
    }

    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

router.get('/:id', async (req: express.Request, res: Response) => {
  try {
    const { id } = req.params;
    const redis = await getRedisClient();
    const cacheKey = `games:${id}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pgPool.query(`
      SELECT g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
             g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(DISTINCT r.id) as rating_count,
             u.name as created_by_name
      FROM games g
      LEFT JOIN ratings r ON g.id = r.game_id
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.id = $1
      GROUP BY g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
               g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at, u.name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = {
      ...result.rows[0],
      average_rating: parseFloat(result.rows[0].average_rating) || 0,
      rating_count: parseInt(result.rows[0].rating_count) || 0,
    };

    await redis.setEx(cacheKey, 300, JSON.stringify(game));

    res.json(game);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

router.get('/search/:query', async (req: express.Request, res: Response) => {
  try {
    const { query } = req.params;
    const searchTerm = `%${query}%`;

    const result = await pgPool.query(`
      SELECT g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
             g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(DISTINCT r.id) as rating_count
      FROM games g
      LEFT JOIN ratings r ON g.id = r.game_id
      WHERE g.title ILIKE $1 OR g.description ILIKE $1 OR g.genre ILIKE $1
      GROUP BY g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
               g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at
      ORDER BY g.title
    `, [searchTerm]);

    const games = result.rows.map(row => ({
      ...row,
      average_rating: parseFloat(row.average_rating) || 0,
      rating_count: parseInt(row.rating_count) || 0,
    }));

    res.json(games);
  } catch (error) {
    console.error('Search games error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/:id/recommendations', async (req: express.Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await getNeo4jSession();

    if (!session) {
      return res.json([]);
    }

    const result = await session.run(`
      MATCH (g:Game {id: $gameId})-[r:RELATED_TO]-(g2:Game)
      RETURN g2.id as id, r.weight as weight
      ORDER BY r.weight DESC
      LIMIT 5
    `, { gameId: parseInt(id) });

    const recommendedIds = result.records.map((record: any) => record.get('id'));

    if (recommendedIds.length === 0) {
      return res.json([]);
    }

    const placeholders = recommendedIds.map((_: any, i: number) => `$${i + 1}`).join(',');
    const pgResult = await pgPool.query(`
      SELECT g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
             g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(DISTINCT r.id) as rating_count
      FROM games g
      LEFT JOIN ratings r ON g.id = r.game_id
      WHERE g.id IN (${placeholders})
      GROUP BY g.id, g.title, g.description, g.genre, g.platform, g.release_date, 
               g.image_url, g.trailer_url, g.game_mode, g.created_by, g.created_at, g.updated_at
    `, recommendedIds);

    const recommendations = pgResult.rows.map(row => ({
      ...row,
      average_rating: parseFloat(row.average_rating) || 0,
      rating_count: parseInt(row.rating_count) || 0,
    }));

    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

export default router;

