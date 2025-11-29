# Projet Big Data NoSQL
## auteur : Aristide, Quentin, Mikhail

# Game Platform - Plateforme de Jeux

Application web permettant aux utilisateurs de noter, commenter et gérer leur liste de jeux. Les administrateurs peuvent ajouter de nouveaux jeux à la plateforme.

## Fonctionnalités

- **Gestion des jeux** : Liste complète de jeux avec détails
- **Système de notation** : Les utilisateurs peuvent noter les jeux (1-5 étoiles)
- **Commentaires** : Système de commentaires pour chaque jeu
- **Liste personnelle** : Chaque utilisateur peut créer sa liste de jeux joués
- **Administration** : Interface admin pour ajouter/modifier des jeux

# Guide de Configuration et Démarrage

## Démarrage Rapide

### 1. Cloner le projet
```bash
git clone <votre-repo>
cd projet_docker
```

### 2. Démarrer l'application
```bash
docker compose up -d
```

Cette commande va :
- Construire les images Docker pour le backend et le frontend
- Démarrer tous les services (PostgreSQL, MongoDB, Redis, Neo4j)
- Initialiser les bases de données avec les tables et utilisateurs par défaut

### 3. Accéder à l'application
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:3001
- **Neo4j Browser** : http://localhost:7474

### 4. Comptes par défaut

**Administrateur :**
- Email: `admin@gameplatform.com`
- Password: `Admin123!`

**Utilisateur test :**
- Email: `user@test.com`
- Password: `User123!`

## Vérification de la Persistance

### PostgreSQL
```bash
docker exec -it game-platform-postgres psql -U gameuser -d gameplatform
```

Requêtes utiles :
```sql
-- Voir tous les jeux
SELECT * FROM games;

-- Voir tous les utilisateurs
SELECT id, email, name, role FROM users;

-- Voir les notes
SELECT g.title, u.name, r.rating 
FROM ratings r
JOIN games g ON r.game_id = g.id
JOIN users u ON r.user_id = u.id;
```

### MongoDB
```bash
docker exec -it game-platform-mongodb mongosh gameplatform
```

Requêtes utiles :
```javascript
// Voir tous les commentaires
db.comments.find().pretty()

// Voir les listes de jeux des utilisateurs
db.user_games.find().pretty()

// Compter les commentaires par jeu
db.comments.aggregate([
  { $group: { _id: "$gameId", count: { $sum: 1 } } }
])
```

### Redis
```bash
docker exec -it game-platform-redis redis-cli
```

Commandes utiles :
```bash
# Voir toutes les clés
KEYS *

# Voir une valeur spécifique
GET games:all

# Voir toutes les clés de cache
KEYS games:*

# Supprimer le cache
DEL games:all
```

### Neo4j
Accéder à http://localhost:7474 dans votre navigateur.

**Identifiants :**
- Username: `neo4j`
- Password: `neo4jpass123`

Requêtes Cypher utiles :
```cypher
// Voir tous les jeux
MATCH (g:Game) RETURN g LIMIT 25

// Voir les relations entre jeux
MATCH (g:Game)-[r:RELATED_TO]->(g2:Game)
RETURN g, r, g2
LIMIT 25

// Voir les notes des utilisateurs
MATCH (u:User)-[r:RATED]->(g:Game)
RETURN u, r, g
LIMIT 25

// Trouver les jeux les plus liés
MATCH (g:Game)-[r:RELATED_TO]->(g2:Game)
RETURN g.title, g2.title, r.weight
ORDER BY r.weight DESC
LIMIT 10
```


## Architecture des Données

### PostgreSQL
- **users** : Utilisateurs de la plateforme
- **games** : Jeux de la plateforme
- **ratings** : Notes données par les utilisateurs

### MongoDB
- **comments** : Commentaires sur les jeux
- **user_games** : Listes personnelles des utilisateurs

### Redis
- Cache des requêtes de jeux
- Sessions utilisateurs

### Neo4j
- **Game** : Nœuds représentant les jeux
- **User** : Nœuds représentant les utilisateurs
- **RATED** : Relations entre utilisateurs et jeux (avec la note)
- **RELATED_TO** : Relations entre jeux similaires (basées sur les notes)

## Sécurité

- **JWT** : Authentification par tokens
- **Bcrypt** : Hashage des mots de passe
- **Helmet** : Protection des en-têtes HTTP
- **Rate Limiting** : Limitation des requêtes
- **Validation** : Validation des données avec express-validator
- **CORS** : Configuration CORS pour le frontend

## Dépannage

### Les services ne démarrent pas
```bash
# Voir les logs
docker compose logs

# Redémarrer les services
docker compose restart
```

### Réinitialiser les bases de données
```bash
# Arrêter et supprimer les volumes
docker compose down -v

# Redémarrer
docker compose up -d
```

### Problèmes de connexion
- Vérifier que tous les ports sont disponibles (3000, 3001, 5432, 27017, 6379, 7474, 7687)
- Vérifier les logs avec `docker compose logs <service-name>`

## Notes

- si ca prend du temps à ce lancer c'est normal

