import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

export const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'gameplatform',
  user: process.env.POSTGRES_USER || 'gameuser',
  password: process.env.POSTGRES_PASSWORD || 'gamepass123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let mongoClient: MongoClient;
let mongoDb: any;

export async function getMongoDb() {
  if (!mongoDb) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameplatform';
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db('gameplatform');
    console.log('MongoDB connected');
  }
  return mongoDb;
}

let redisClient: ReturnType<typeof createClient>;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    console.log('Redis connected');
  }
  return redisClient;
}

let neo4jDriver: Driver;
let neo4jSession: Session;

export async function getNeo4jSession() {
  if (!neo4jDriver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4jpass123';
    
    neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await neo4jDriver.verifyConnectivity();
    console.log('Neo4j connected');
  }
  if (!neo4jSession) {
    neo4jSession = neo4jDriver.session();
  }
  return neo4jSession;
}

async function retryConnection<T>(
  fn: () => Promise<T>,
  maxRetries: number = 10,
  delay: number = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(`Retry ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}

export async function initDatabases() {
  try {
    await retryConnection(async () => {
      await pgPool.query('SELECT NOW()');
    });
    console.log('PostgreSQL connected');
    
    await retryConnection(async () => {
      await getMongoDb();
    });
    
    await retryConnection(async () => {
      await getRedisClient();
    });
    
    await retryConnection(async () => {
      await getNeo4jSession();
    });
    
    await runMigrations();
    
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function runMigrations() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        genre VARCHAR(100),
        platform VARCHAR(100),
        release_date DATE,
        image_url VARCHAR(500),
        trailer_url VARCHAR(500),
        game_mode VARCHAR(20) DEFAULT 'solo' CHECK (game_mode IN ('solo', 'multiplayer', 'both')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgPool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'solo' 
      CHECK (game_mode IN ('solo', 'multiplayer', 'both'))
    `).catch(() => {});

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, user_id)
      )
    `);

    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_ratings_game_id ON ratings(game_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
    `);

    const bcrypt = require('bcryptjs');
    const adminCheck = await pgPool.query('SELECT id FROM users WHERE email = $1', ['admin@gameplatform.com']);
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await pgPool.query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        ['admin@gameplatform.com', hashedPassword, 'Admin', 'admin']
      );
    }

    const userCheck = await pgPool.query('SELECT id FROM users WHERE email = $1', ['user@test.com']);
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('User123!', 10);
      await pgPool.query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        ['user@test.com', hashedPassword, 'Test User', 'user']
      );
    }
    const gamesCheck = await pgPool.query('SELECT COUNT(*) as count FROM games');
    const gamesExist = parseInt(gamesCheck.rows[0].count) > 0;
    
    if (!gamesExist) {
      const adminId = adminCheck.rows.length > 0 ? adminCheck.rows[0].id : (await pgPool.query('SELECT id FROM users WHERE email = $1', ['admin@gameplatform.com'])).rows[0].id;
      
      const defaultGames = [
        {
          title: 'The Witcher 3: Wild Hunt',
          description: 'Un jeu de rôle épique dans un monde ouvert fantastique. Incarnez Geralt de Riv, un chasseur de monstres professionnel.',
          genre: 'RPG',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2015-05-19',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/c0i88t0Kacs',
          game_mode: 'solo'
        },
        {
          title: 'Cyberpunk 2077',
          description: 'Un RPG d\'action-aventure futuriste dans la mégalopole de Night City.',
          genre: 'RPG, Action',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2020-12-10',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/qIcTM8WXFjk',
          game_mode: 'both'
        },
        {
          title: 'Elden Ring',
          description: 'Un jeu d\'action-RPG dans un monde ouvert créé par FromSoftware et George R.R. Martin.',
          genre: 'Action-RPG',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2022-02-25',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/E3Huy2cdih0',
          game_mode: 'both'
        },
        {
          title: 'Red Dead Redemption 2',
          description: 'Un western épique dans l\'Amérique de la fin du 19ème siècle.',
          genre: 'Action-Aventure',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2018-10-26',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/gmA6MrX81z4',
          game_mode: 'both'
        },
        {
          title: 'God of War',
          description: 'Kratos et son fils Atreus partent en voyage dans les royaumes nordiques.',
          genre: 'Action-Aventure',
          platform: 'PlayStation, PC',
          release_date: '2018-04-20',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1593500/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/K0u_kAWLJOA',
          game_mode: 'solo'
        },
        {
          title: 'Assassin\'s Creed Valhalla',
          description: 'Incarnez Eivor, un guerrier viking légendaire, dans une aventure épique de l\'Angleterre du IXe siècle.',
          genre: 'Action-Aventure',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2020-11-10',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2208920/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/ssrNcwxALS4',
          game_mode: 'both'
        },
        {
          title: 'Horizon Zero Dawn',
          description: 'Explorez un monde post-apocalyptique peuplé de machines dans ce RPG d\'action à monde ouvert.',
          genre: 'Action-RPG',
          platform: 'PC, PlayStation',
          release_date: '2017-02-28',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1151640/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/u4-FCsiF5x4',
          game_mode: 'solo'
        },
        {
          title: 'Ghost of Tsushima',
          description: 'Un samouraï se bat pour libérer l\'île de Tsushima de l\'invasion mongole au XIIIe siècle.',
          genre: 'Action-Aventure',
          platform: 'PlayStation, PC',
          release_date: '2020-07-17',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2215430/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/iqysmS4lxwQ',
          game_mode: 'both'
        },
        {
          title: 'The Last of Us Part II',
          description: 'Une suite émotionnelle et intense qui suit Ellie dans un monde post-apocalyptique.',
          genre: 'Action-Aventure',
          platform: 'PlayStation, PC',
          release_date: '2020-06-19',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1888930/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/btmN-bWwv0A',
          game_mode: 'solo'
        },
        {
          title: 'Resident Evil 4',
          description: 'Une réinvention du classique de survie horrifique avec des graphismes modernes et un gameplay amélioré.',
          genre: 'Survival Horror',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2023-03-24',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2050650/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/W1OUs3HwIuo',
          game_mode: 'solo'
        },
        {
          title: 'Spider-Man: Miles Morales',
          description: 'Incarnez Miles Morales dans une nouvelle aventure épique de Spider-Man à New York.',
          genre: 'Action-Aventure',
          platform: 'PlayStation, PC',
          release_date: '2020-11-12',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1817190/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/3R2uvJqWeVg',
          game_mode: 'solo'
        },
        {
          title: 'Final Fantasy VII Remake',
          description: 'Une réinvention épique du classique RPG avec des graphismes modernes et un combat en temps réel.',
          genre: 'RPG',
          platform: 'PC, PlayStation',
          release_date: '2021-12-16',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1462040/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/A3sBZ5Nr4hc',
          game_mode: 'solo'
        },
        {
          title: 'Hades',
          description: 'Un roguelike action où vous jouez le fils d\'Hadès dans une tentative d\'échapper des Enfers.',
          genre: 'Roguelike, Action',
          platform: 'PC, PlayStation, Xbox, Switch',
          release_date: '2020-09-17',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/tlvEVPSFuYk',
          game_mode: 'solo'
        },
        {
          title: 'Baldur\'s Gate 3',
          description: 'Un RPG épique basé sur D&D avec des choix qui façonnent votre aventure dans un monde fantastique.',
          genre: 'RPG',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2023-08-03',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/1T22wNvoNiU',
          game_mode: 'both'
        },
        {
          title: 'The Legend of Zelda: Breath of the Wild',
          description: 'Explorez le royaume d\'Hyrule dans cette aventure épique en monde ouvert.',
          genre: 'Action-Aventure',
          platform: 'Nintendo Switch, Wii U',
          release_date: '2017-03-03',
          image_url: 'https://upload.wikimedia.org/wikipedia/en/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg',
          trailer_url: 'https://www.youtube.com/embed/1rPxiXXxftE',
          game_mode: 'solo'
        },
        {
          title: 'Grand Theft Auto V',
          description: 'Vivez trois histoires entrelacées dans la ville de Los Santos dans ce jeu d\'action à monde ouvert.',
          genre: 'Action-Aventure',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2013-09-17',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/hvoD7ehZPcM',
          game_mode: 'both'
        },
        {
          title: 'Dark Souls III',
          description: 'Un RPG d\'action difficile dans un monde sombre et fantastique rempli de dangers.',
          genre: 'Action-RPG',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2016-04-12',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/374320/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/_zDZYrIUgKE',
          game_mode: 'both'
        },
        {
          title: 'Sekiro: Shadows Die Twice',
          description: 'Un ninja se bat pour sauver son maître dans le Japon féodal dans ce jeu d\'action intense.',
          genre: 'Action-Aventure',
          platform: 'PC, PlayStation, Xbox',
          release_date: '2019-03-22',
          image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/814380/header.jpg',
          trailer_url: 'https://www.youtube.com/embed/4OgoTZXPACo',
          game_mode: 'solo'
        }
      ];

      for (const game of defaultGames) {
        await pgPool.query(
          `INSERT INTO games (title, description, genre, platform, release_date, image_url, trailer_url, game_mode, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [game.title, game.description, game.genre, game.platform, game.release_date, game.image_url, game.trailer_url, game.game_mode || 'solo', adminId]
        );
      }
    } else {
      const imageUpdates = [
        { title: 'The Witcher 3: Wild Hunt', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg', trailer_url: 'https://www.youtube.com/embed/c0i88t0Kacs' },
        { title: 'Cyberpunk 2077', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg', trailer_url: 'https://www.youtube.com/embed/qIcTM8WXFjk' },
        { title: 'Elden Ring', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg', trailer_url: 'https://www.youtube.com/embed/E3Huy2cdih0' },
        { title: 'Red Dead Redemption 2', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/header.jpg', trailer_url: 'https://www.youtube.com/embed/gmA6MrX81z4' },
        { title: 'God of War', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1593500/header.jpg', trailer_url: 'https://www.youtube.com/embed/K0u_kAWLJOA' },
        { title: 'Assassin\'s Creed Valhalla', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2208920/header.jpg', trailer_url: 'https://www.youtube.com/embed/ssrNcwxALS4' },
        { title: 'Horizon Zero Dawn', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1151640/header.jpg', trailer_url: 'https://www.youtube.com/embed/u4-FCsiF5x4' },
        { title: 'Ghost of Tsushima', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2215430/header.jpg', trailer_url: 'https://www.youtube.com/embed/iqysmS4lxwQ' },
        { title: 'The Last of Us Part II', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1888930/header.jpg', trailer_url: 'https://www.youtube.com/embed/btmN-bWwv0A' },
        { title: 'Resident Evil 4', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2050650/header.jpg', trailer_url: 'https://www.youtube.com/embed/W1OUs3HwIuo' },
        { title: 'Spider-Man: Miles Morales', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1817190/header.jpg', trailer_url: 'https://www.youtube.com/embed/3R2uvJqWeVg' },
        { title: 'Final Fantasy VII Remake', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1462040/header.jpg', trailer_url: 'https://www.youtube.com/embed/A3sBZ5Nr4hc' },
        { title: 'Hades', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg', trailer_url: 'https://www.youtube.com/embed/tlvEVPSFuYk' },
        { title: 'Baldur\'s Gate 3', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg', trailer_url: 'https://www.youtube.com/embed/1T22wNvoNiU' },
        { title: 'The Legend of Zelda: Breath of the Wild', image_url: 'https://upload.wikimedia.org/wikipedia/en/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg', trailer_url: 'https://www.youtube.com/embed/1rPxiXXxftE' },
        { title: 'Grand Theft Auto V', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg', trailer_url: 'https://www.youtube.com/embed/hvoD7ehZPcM' },
        { title: 'Dark Souls III', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/374320/header.jpg', trailer_url: 'https://www.youtube.com/embed/_zDZYrIUgKE' },
        { title: 'Sekiro: Shadows Die Twice', image_url: 'https://cdn.cloudflare.steamstatic.com/steam/apps/814380/header.jpg', trailer_url: 'https://www.youtube.com/embed/4OgoTZXPACo' }
      ];
      
          for (const update of imageUpdates) {
            await pgPool.query(
              'UPDATE games SET image_url = $1, trailer_url = $2 WHERE title = $3',
              [update.image_url, update.trailer_url, update.title]
            );
          }
    }

    const session = await getNeo4jSession();
    await session.run(`
      CREATE CONSTRAINT game_id IF NOT EXISTS
      FOR (g:Game) REQUIRE g.id IS UNIQUE
    `).catch(() => {});

    await session.run(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User) REQUIRE u.id IS UNIQUE
    `).catch(() => {});

    const allGames = await pgPool.query('SELECT id, title, genre FROM games');
    for (const game of allGames.rows) {
      try {
        await session.run(`
          MERGE (g:Game {id: $id})
          SET g.title = $title, g.genre = $genre
        `, { id: game.id, title: game.title, genre: game.genre || '' });
      } catch (error) {
        console.warn(`Failed to sync game ${game.id} to Neo4j:`, error);
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

