import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { gamesApi, ratingsApi, commentsApi, userGamesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaStar, FaCalendarAlt, FaGamepad, FaPlus, FaTrash, FaSpinner } from 'react-icons/fa';

function convertToEmbedUrl(url: string): string {
  if (!url) return url;
  
  if (url.includes('youtube.com/embed/')) {
    return url;
  }
  
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  return url;
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [game, setGame] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInMyList, setIsInMyList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('ID du jeu manquant');
      setGame(null);
      gameRef.current = null;
      return;
    }
    
    gameRef.current = null;
    let isMounted = true;
    
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        setUserRating(null);
        setIsInMyList(false);
        
        await loadGame();
        
        loadComments().catch(() => {});
        loadRecommendations().catch(() => {});
        
        if (user) {
          loadUserRating().catch(() => {});
          checkMyList().catch(() => {});
        }
      } catch (error: any) {
        console.error('Error loading game:', error);
        if (isMounted) {
          const errorMessage = error.response?.data?.error || error.message || 'Erreur lors du chargement du jeu';
          setError(errorMessage);
          if (!game) {
            setGame(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAll();
    
    return () => {
      isMounted = false;
    };
  }, [id, user]);
  
  useEffect(() => {
    if (!user || !id) {
      setUserRating(null);
      setIsInMyList(false);
      return;
    }

    loadUserRating();
    checkMyList();
  }, [user, id]);

  const loadGame = async () => {
    if (!id) {
      setError('ID du jeu manquant');
      if (!game) {
        setGame(null);
      }
      return;
    }
    try {
      setError(null);
      const response = await gamesApi.getById(parseInt(id));
      if (response && response.data) {
        const gameData = {
          ...response.data,
          average_rating: (() => {
            const rating = response.data.average_rating;
            if (rating == null) return 0;
            if (typeof rating === 'number') return rating;
            const parsed = parseFloat(rating);
            return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
          })(),
        };
        setGame(gameData);
        setError(null);
      } else {
        setError('Jeu non trouvé');
        if (!game) {
          setGame(null);
        }
      }
    } catch (error: any) {
      console.error('Error loading game:', error);
      if (error.response?.status === 401) {
        try {
          const response = await gamesApi.getById(parseInt(id));
          if (response && response.data) {
            const gameData = {
              ...response.data,
              average_rating: (() => {
                const rating = response.data.average_rating;
                if (rating == null) return 0;
                if (typeof rating === 'number') return rating;
                const parsed = parseFloat(rating);
                return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
              })(),
            };
            setGame(gameData);
            setError(null);
            return;
          }
        } catch (retryError: any) {
          console.error('Retry failed:', retryError);
          const errorMessage = retryError.response?.data?.error || retryError.message || 'Erreur lors du chargement du jeu';
          setError(errorMessage);
          if (!game) {
            setGame(null);
          }
        }
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Erreur lors du chargement du jeu';
        setError(errorMessage);
        if (!game) {
          setGame(null);
        }
        if (error.response?.status !== 429 && error.response?.status !== 401) {
          toast.error(errorMessage);
        }
      }
    }
  };

  const loadUserRating = async () => {
    if (!user || !id) {
      setUserRating(null);
      return;
    }
    try {
      const response = await ratingsApi.getUserRating(parseInt(id));
      
      if (response?.data?.rating?.rating !== undefined) {
        setUserRating(response.data.rating.rating);
        return;
      }
      
      if (Array.isArray(response?.data)) {
        const found = response.data.find((r: any) => r.game_id === parseInt(id) || r.gameId === parseInt(id));
        setUserRating(found?.rating ?? null);
        return;
      }
      
      setUserRating(null);
    } catch {
      setUserRating(null);
    }
  };

  const loadComments = async () => {
    if (!id) return;
    try {
      const response = await commentsApi.getByGame(parseInt(id));
      setComments(Array.isArray(response?.data) ? response.data : []);
    } catch {
      setComments([]);
    }
  };

  const checkMyList = async () => {
    if (!user || !id) {
      setIsInMyList(false);
      return;
    }
    try {
      const response = await userGamesApi.getMyList();
      if (response && response.data && response.data.games) {
        setIsInMyList(response.data.games.includes(parseInt(id)));
      } else {
        setIsInMyList(false);
      }
    } catch (error: any) {
      // Silently handle auth and rate limit errors
      if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 429) {
        setIsInMyList(false);
      } else {
        console.error('Error checking my list:', error);
        setIsInMyList(false);
      }
    }
  };

  const loadRecommendations = async () => {
    if (!id) return;
    try {
      const response = await gamesApi.getRecommendations(parseInt(id));
      const recommendations = Array.isArray(response?.data) ? response.data : [];
      setRecommendations(recommendations.map((rec: any) => ({
        ...rec,
        average_rating: (() => {
          if (rec.average_rating == null) return 0;
          if (typeof rec.average_rating === 'number') return rec.average_rating;
          const parsed = parseFloat(rec.average_rating);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        })(),
      })));
    } catch {
      setRecommendations([]);
    }
  };

  const handleRating = async (rating: number) => {
    if (!user || !id) {
      toast.error('Vous devez être connecté pour noter');
      return;
    }

    try {
      await ratingsApi.create(parseInt(id), rating);
      setUserRating(rating);
      toast.success('Note enregistrée !');
      
      try {
        const response = await gamesApi.getById(parseInt(id));
        if (response && response.data) {
          const gameData = {
            ...response.data,
            average_rating: (() => {
              const rating = response.data.average_rating;
              if (rating == null) return 0;
              if (typeof rating === 'number') return rating;
              const parsed = parseFloat(rating);
              return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
            })(),
          };
          setGame(gameData);
        }
      } catch {
        // Ignore errors when refreshing game data after rating
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement de la note');
    }
  };

  const handleAddComment = async () => {
    if (!user || !id || !newComment.trim()) return;

    try {
      await commentsApi.create(parseInt(id), newComment);
      setNewComment('');
      toast.success('Commentaire ajouté !');
      loadComments().catch(() => {});
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout du commentaire');
    }
  };

  const handleToggleMyList = async () => {
    if (!user || !id) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      if (isInMyList) {
        await userGamesApi.remove(parseInt(id));
        setIsInMyList(false);
        toast.success('Retiré de votre liste');
      } else {
        await userGamesApi.add(parseInt(id));
        setIsInMyList(true);
        toast.success('Ajouté à votre liste');
      }
    } catch (error: any) {
      toast.error('Erreur');
    }
  };

  useEffect(() => {
    if (game && game.id && id && game.id.toString() === id) {
      gameRef.current = game;
    } else if (id && game && game.id && game.id.toString() !== id) {
      gameRef.current = null;
    }
  }, [game, id]);

  useEffect(() => {
    if (game && loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [game, loading]);


  const displayGame = game || (gameRef.current && gameRef.current.id && id && gameRef.current.id.toString() === id ? gameRef.current : null);

  if (displayGame && typeof displayGame === 'object') {
    const finalGame = displayGame;

  return (
    <div>
      {/* Hero Section avec image de fond */}
      <div className="relative mb-8 rounded-xl overflow-hidden">
        {finalGame.image_url ? (
          <div className="relative h-96">
            <img
              src={finalGame.image_url}
              alt={finalGame.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h1 className="text-5xl font-bold text-white mb-2">{finalGame.title}</h1>
              <div className="flex items-center space-x-4 text-white">
                {finalGame.genre && (
                  <span className="px-3 py-1 bg-purple-500/80 backdrop-blur-sm rounded-full text-sm font-semibold">
                    {finalGame.genre}
                  </span>
                )}
                {finalGame.platform && (
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                    {finalGame.platform}
                  </span>
                )}
                {finalGame.release_date && (
                  <span className="flex items-center space-x-1">
                    <FaCalendarAlt />
                    <span>{new Date(finalGame.release_date).toLocaleDateString('fr-FR')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-96 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-6 flex items-center justify-center">
            <FaGamepad className="text-white text-8xl" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="glass rounded-xl p-6 mb-6">

            {/* Trailer section en premier */}
            {finalGame.trailer_url && (
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-4 gradient-text">Trailer</h3>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black shadow-2xl">
                  <iframe
                    src={convertToEmbedUrl(finalGame.trailer_url)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Game Trailer"
                  ></iframe>
                </div>
              </div>
            )}

            {/* Description */}
            {finalGame.description && (
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-3 gradient-text">Description</h3>
                <p className="text-gray-300 text-lg leading-relaxed">
                  {finalGame.description}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-4 mb-6">
              <div className="flex items-center space-x-2">
                <FaStar className="text-yellow-400 text-2xl" />
                <span className="text-2xl font-bold">
                  {(() => {
                    if (finalGame.average_rating == null) return 'N/A';
                    const rating = typeof finalGame.average_rating === 'number' 
                      ? finalGame.average_rating 
                      : (typeof finalGame.average_rating === 'string' ? parseFloat(finalGame.average_rating) : 0);
                    return !isNaN(rating) && isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'N/A';
                  })()}
                </span>
                {finalGame.rating_count !== undefined && finalGame.rating_count > 0 && (
                  <span className="text-gray-500">
                    ({finalGame.rating_count} avis)
                  </span>
                )}
              </div>
            </div>

            {/* Actions utilisateur */}
            <div className="border-t border-purple-500/20 pt-6 space-y-6">
              {user ? (
                <>
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-white">Votre note</h3>
                    <div className="flex space-x-2 mb-4">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => handleRating(rating)}
                          className={`text-4xl transition-all hover:scale-125 ${
                            userRating && userRating >= rating
                              ? 'text-yellow-400'
                              : 'text-gray-500 hover:text-yellow-300'
                          }`}
                        >
                          <FaStar />
                        </button>
                      ))}
                    </div>
                    {userRating && (
                      <p className="text-gray-400 text-sm">Vous avez noté {userRating}/5</p>
                    )}
                  </div>
                  
                  <div>
                    <button
                      onClick={handleToggleMyList}
                      className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-all ${
                        isInMyList
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                      }`}
                    >
                      {isInMyList ? <FaTrash /> : <FaPlus />}
                      <span>{isInMyList ? 'Retirer de ma liste' : 'Ajouter à ma liste'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-300 mb-4">Connectez-vous pour noter et ajouter à votre liste</p>
                  <Link to="/login" className="btn-primary inline-block">
                    Se connecter
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-6 mt-6">
            <h3 className="text-xl font-bold mb-4 text-white">Commentaires ({comments.length})</h3>

            {user ? (
              <div className="mb-6 glass rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Ajouter un commentaire</h4>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Partagez votre avis sur ce jeu..."
                  className="input h-24 resize-none mb-3"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="btn-primary w-full"
                >
                  Publier mon commentaire
                </button>
              </div>
            ) : (
              <div className="mb-6 glass rounded-lg p-4 text-center">
                <p className="text-gray-300 mb-3">
                  <Link to="/login" className="text-purple-400 hover:text-purple-300 hover:underline font-semibold">
                    Connectez-vous
                  </Link>{' '}
                  pour ajouter un commentaire
                </p>
                <Link to="/login" className="btn-primary inline-block">
                  Se connecter
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Aucun commentaire pour le moment. Soyez le premier à commenter !</p>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment._id} className="glass rounded-lg p-4 border border-purple-500/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {(comment.userName || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="font-semibold text-white">
                        {comment.userName || 'Utilisateur'}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          {recommendations.length > 0 && (
            <div className="glass rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold mb-4 text-white">Recommandations</h3>
              <div className="space-y-4">
                {recommendations.map((rec) => (
                  <Link
                    key={rec.id}
                    to={`/game/${rec.id}`}
                    className="block p-3 border border-purple-500/20 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <h4 className="font-semibold text-white">{rec.title}</h4>
                    {(() => {
                      const rating = typeof rec.average_rating === 'number' ? rec.average_rating : parseFloat(rec.average_rating);
                      return rating && !isNaN(rating) && rating > 0;
                    })() && (
                      <div className="flex items-center space-x-1 mt-1">
                        <FaStar className="text-yellow-400 text-sm" />
                        <span className="text-sm text-gray-300">{(() => {
                          if (rec.average_rating == null) return '0.0';
                          const rating = typeof rec.average_rating === 'number' 
                            ? rec.average_rating 
                            : (typeof rec.average_rating === 'string' ? parseFloat(rec.average_rating) : 0);
                          return !isNaN(rating) && isFinite(rating) && rating > 0 ? rating.toFixed(1) : '0.0';
                        })()}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  }

  if (!displayGame && loading && !error) {
    return (
      <div className="flex justify-center items-center py-20 min-h-screen bg-gray-900">
        <FaSpinner className="animate-spin text-4xl text-purple-400" />
      </div>
    );
  }

  if (!displayGame && !loading && error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-screen bg-gray-900">
        <div className="text-white text-2xl font-bold mb-4">
          {error}
        </div>
        <p className="text-gray-300 mb-6">
          {error.includes('429') || error.includes('Too many requests') 
            ? 'Trop de requêtes. Veuillez patienter quelques instants et réessayer.'
            : 'Le jeu que vous recherchez n\'existe pas ou a été supprimé.'}
        </p>
        <Link to="/" className="btn-primary inline-block">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  if (!displayGame && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-screen bg-gray-900">
        <div className="text-white text-2xl font-bold mb-4">
          Jeu non trouvé
        </div>
        <p className="text-gray-300 mb-6">Le jeu que vous recherchez n'existe pas ou a été supprimé.</p>
        <Link to="/" className="btn-primary inline-block">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-20 min-h-screen bg-gray-900">
      <FaSpinner className="animate-spin text-4xl text-purple-400" />
    </div>
  );
}

