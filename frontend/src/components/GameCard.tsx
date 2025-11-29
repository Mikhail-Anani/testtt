import { Link } from 'react-router-dom';
import { FaStar, FaCalendarAlt, FaGamepad } from 'react-icons/fa';

interface GameCardProps {
  game: {
    id: number;
    title: string;
    description?: string;
    genre?: string;
    platform?: string;
    release_date?: string;
    image_url?: string;
    average_rating?: number;
    rating_count?: number;
  };
}

export default function GameCard({ game }: GameCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <Link to={`/game/${game.id}`}>
      <div className="card h-full overflow-hidden">
        {game.image_url ? (
          <div className="w-full h-48 flex items-center justify-center mb-4">
            <img
              src={game.image_url}
              alt={game.title}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-purple-500 to-pink-500 mb-4 flex items-center justify-center">
            <FaGamepad className="text-white text-6xl" />
          </div>
        )}
        
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
          {game.title}
        </h3>
        
        {game.description && (
          <p className="text-gray-300 text-sm mb-3 line-clamp-2">
            {game.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-3">
          {game.genre && (
            <span className="px-3 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs font-semibold">
              {game.genre}
            </span>
          )}
          {game.platform && (
            <span className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs">
              {game.platform}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <FaStar className="text-yellow-400" />
            <span className="font-semibold text-white">
              {(() => {
                if (game.average_rating == null) return 'N/A';
                const rating = typeof game.average_rating === 'number' 
                  ? game.average_rating 
                  : (typeof game.average_rating === 'string' ? parseFloat(game.average_rating) : 0);
                return !isNaN(rating) && isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'N/A';
              })()}
            </span>
            {game.rating_count !== undefined && game.rating_count > 0 && (
              <span className="text-gray-400 text-sm">
                ({game.rating_count})
              </span>
            )}
          </div>
          
          {game.release_date && (
            <div className="flex items-center space-x-1 text-gray-400 text-sm">
              <FaCalendarAlt />
              <span>{formatDate(game.release_date)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

