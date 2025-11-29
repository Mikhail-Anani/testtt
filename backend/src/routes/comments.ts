import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../db/connections';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/game/:gameId', async (req: express.Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const db = await getMongoDb();
    const comments = await db.collection('comments')
      .find({ gameId: parseInt(gameId) })
      .sort({ createdAt: -1 })
      .toArray();

    const { pgPool } = await import('../db/connections');
    const userIds = [...new Set(comments.map((c: any) => c.userId))];
    if (userIds.length > 0) {
      const placeholders = userIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      const usersResult = await pgPool.query(
        `SELECT id, name, email FROM users WHERE id IN (${placeholders})`,
        userIds
      );
      const usersMap = new Map(usersResult.rows.map((u: any) => [u.id, u]));
      comments.forEach((comment: any) => {
        const user = usersMap.get(comment.userId);
        if (user) {
          comment.userName = user.name;
          comment.userEmail = user.email;
        }
      });
    }

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/',
  authenticate,
  [
    body('gameId').isInt(),
    body('content').trim().isLength({ min: 1, max: 1000 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { gameId, content } = req.body;
      const userId = req.userId!;

      const db = await getMongoDb();
      const comment = {
        gameId: parseInt(gameId),
        userId,
        content: content.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('comments').insertOne(comment);
      const insertedComment = await db.collection('comments').findOne({ _id: result.insertedId });

      res.status(201).json(insertedComment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const db = await getMongoDb();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const result = await db.collection('comments').updateOne(
      { _id: objectId, userId },
      { $set: { content: content.trim(), updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const updatedComment = await db.collection('comments').findOne({
      _id: objectId
    });

    res.json(updatedComment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const db = await getMongoDb();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const result = await db.collection('comments').deleteOne({
      _id: objectId,
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;

