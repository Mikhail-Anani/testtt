import { useState, useEffect } from 'react';
import { userGamesApi, gamesApi } from '../services/api';
import GameCard from '../components/GameCard';
import toast from 'react-hot-toast';
import { FaSpinner, FaGamepad } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export default function MyGames() {
  const { user } = useAuth();
  const [myGameIds, setMyGameIds] = useState<number[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMyGames();
    } else {
      setLoading(false);
      setGames([]);
    }
  }, [user]);

  const loadMyGames = async () => {
    try {
      setLoading(true);
      const response = await userGamesApi.getMyList();
      const gameIds = response.data.games || [];
      setMyGameIds(gameIds);

      if (gameIds.length > 0) {
        const allGamesResponse = await gamesApi.getAll();
        const myGames = allGamesResponse.data
          .filter((game: any) => gameIds.includes(game.id))
          .map((game: any) => ({
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
        setGames(myGames);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de vos jeux');
      console.error(error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <FaSpinner className="animate-spin text-4xl text-purple-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center space-x-3 gradient-text">
          <FaGamepad className="text-purple-400" />
          <span>Ma Liste de Jeux</span>
        </h1>
        <p className="text-gray-300 text-lg">
          {games.length} jeu{games.length > 1 ? 'x' : ''} dans votre liste
        </p>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <FaGamepad className="text-4xl text-white" />
          </div>
          <p className="text-gray-300 text-xl mb-4">Votre liste est vide</p>
          <p className="text-gray-400">
            Ajoutez des jeux à votre liste depuis leur page de détail
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

