import { useState, useEffect } from 'react';
import { gamesApi } from '../services/api';
import GameCard from '../components/GameCard';
import { FaSearch, FaSpinner, FaStar, FaCalendarAlt, FaUsers, FaUser, FaGamepad } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGames(true);
  }, [user]);

  const loadGames = async (skipCache = false) => {
    try {
      setLoading(true);
      const response = await gamesApi.getAll(skipCache);
      const games = (response.data || []).map((game: any) => ({
        ...game,
        average_rating: (() => {
          if (game.average_rating == null) return 0;
          if (typeof game.average_rating === 'number') return game.average_rating;
          const parsed = parseFloat(game.average_rating);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        })(),
        rating_count: typeof game.rating_count === 'number' 
          ? game.rating_count 
          : (parseInt(game.rating_count) || 0),
      }));
      setGames(games);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des jeux');
      console.error(error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadGames();
      return;
    }

    try {
      setLoading(true);
      const response = await gamesApi.search(searchQuery);
      const games = (response.data || []).map((game: any) => ({
        ...game,
        average_rating: (() => {
          if (game.average_rating == null) return 0;
          if (typeof game.average_rating === 'number') return game.average_rating;
          const parsed = parseFloat(game.average_rating);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        })(),
        rating_count: typeof game.rating_count === 'number' 
          ? game.rating_count 
          : (parseInt(game.rating_count) || 0),
      }));
      setGames(games);
    } catch (error: any) {
      toast.error('Erreur lors de la recherche');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [activeCategory, setActiveCategory] = useState('all');

  const filterGames = async (category: string) => {
    setActiveCategory(category);
    try {
      setLoading(true);
      const response = await gamesApi.getAll();
      let filtered = (response.data || []).map((game: any) => ({
        ...game,
        average_rating: (() => {
          if (game.average_rating == null) return 0;
          if (typeof game.average_rating === 'number') return game.average_rating;
          const parsed = parseFloat(game.average_rating);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        })(),
        rating_count: typeof game.rating_count === 'number' 
          ? game.rating_count 
          : (parseInt(game.rating_count) || 0),
      }));
      
      if (category === 'top') {
        filtered = filtered.sort((a: any, b: any) => (b.average_rating || 0) - (a.average_rating || 0));
      } else if (category === 'recent') {
        filtered = filtered.sort((a: any, b: any) => {
          const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
          const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
          return dateB - dateA;
        });
      } else if (category === 'multiplayer') {
        filtered = filtered.filter((game: any) => 
          game.game_mode === 'multiplayer' || game.game_mode === 'both'
        );
      } else if (category === 'solo') {
        filtered = filtered.filter((game: any) => 
          game.game_mode === 'solo' || game.game_mode === 'both'
        );
      }
      
      setGames(filtered);
    } catch (error: any) {
      toast.error('Erreur lors du filtrage');
    } finally {
      setLoading(false);
    }
  };

  const categoryTitles: { [key: string]: string } = {
    all: 'Tous les jeux',
    top: 'Mieux notés',
    recent: 'Plus récents',
    multiplayer: 'Multijoueur',
    solo: 'Solo'
  };

  return (
    <div>
      {/* Filtres de catégorie */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => filterGames('all')}
            className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
          >
            <FaGamepad className="w-4 h-4" />
            <span>Tous les jeux</span>
          </button>
          <button
            onClick={() => filterGames('top')}
            className={`category-btn ${activeCategory === 'top' ? 'active' : ''}`}
          >
            <FaStar className="w-4 h-4" />
            <span>Mieux notés</span>
          </button>
          <button
            onClick={() => filterGames('recent')}
            className={`category-btn ${activeCategory === 'recent' ? 'active' : ''}`}
          >
            <FaCalendarAlt className="w-4 h-4" />
            <span>Plus récents</span>
          </button>
          <button
            onClick={() => filterGames('multiplayer')}
            className={`category-btn ${activeCategory === 'multiplayer' ? 'active' : ''}`}
          >
            <FaUsers className="w-4 h-4" />
            <span>Multijoueur</span>
          </button>
          <button
            onClick={() => filterGames('solo')}
            className={`category-btn ${activeCategory === 'solo' ? 'active' : ''}`}
          >
            <FaUser className="w-4 h-4" />
            <span>Solo</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 gradient-text">
          {categoryTitles[activeCategory] || 'Tous les jeux'}
        </h1>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Rechercher un jeu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="input pl-10"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          <button onClick={handleSearch} className="btn-primary">
            Rechercher
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <FaSpinner className="animate-spin text-4xl text-purple-400" />
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <FaGamepad className="text-4xl text-white" />
          </div>
          <p className="text-gray-300 text-xl mb-2">Aucun jeu trouvé</p>
          <p className="text-gray-400">Essayez une autre recherche ou filtre</p>
        </div>
      ) : (
        <>
          <div className="mb-6 text-gray-300">
            {games.length} jeu{games.length > 1 ? 'x' : ''} trouvé{games.length > 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

