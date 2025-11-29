import { useState, useEffect } from 'react';
import { gamesApi, adminApi } from '../services/api';
import toast from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaCog } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export default function Admin() {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGame, setEditingGame] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    platform: '',
    releaseDate: '',
    imageUrl: '',
    trailerUrl: '',
    gameMode: 'solo',
    imageBase64: '',
  });
  const [previewImage, setPreviewImage] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadGames();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadGames = async () => {
    try {
      setLoading(true);
      const response = await gamesApi.getAll();
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const gameData: any = {};

      if (editingGame) {
        gameData.title = formData.title;
        gameData.description = formData.description || null;
        gameData.genre = formData.genre || null;
        gameData.platform = formData.platform || null;
        gameData.releaseDate = formData.releaseDate || null;
        gameData.imageUrl = formData.imageBase64 || formData.imageUrl || null;
        gameData.trailerUrl = formData.trailerUrl || null;
        gameData.gameMode = formData.gameMode || 'solo';
      } else {
        gameData.title = formData.title;
        if (formData.description) gameData.description = formData.description;
        if (formData.genre) gameData.genre = formData.genre;
        if (formData.platform) gameData.platform = formData.platform;
        if (formData.releaseDate) gameData.releaseDate = formData.releaseDate;
        if (formData.imageBase64 || formData.imageUrl) {
          gameData.imageUrl = formData.imageBase64 || formData.imageUrl;
        }
        if (formData.trailerUrl) gameData.trailerUrl = formData.trailerUrl;
        gameData.gameMode = formData.gameMode;
      }

      if (editingGame) {
        await adminApi.updateGame(editingGame.id, gameData);
        toast.success('Jeu mis à jour !');
      } else {
        await adminApi.createGame(gameData);
        toast.success('Jeu créé !');
      }
      setShowModal(false);
      setEditingGame(null);
      setFormData({
        title: '',
        description: '',
        genre: '',
        platform: '',
        releaseDate: '',
        imageUrl: '',
        trailerUrl: '',
        gameMode: 'solo',
        imageBase64: '',
      });
      setPreviewImage('');
      loadGames();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const handleEdit = (game: any) => {
    setEditingGame(game);
    setFormData({
      title: game.title,
      description: game.description || '',
      genre: game.genre || '',
      platform: game.platform || '',
      releaseDate: game.release_date || '',
      imageUrl: game.image_url && !game.image_url.startsWith('data:') ? game.image_url : '',
      trailerUrl: game.trailer_url || '',
      gameMode: game.game_mode || 'solo',
      imageBase64: game.image_url && game.image_url.startsWith('data:') ? game.image_url : '',
    });
    setPreviewImage(game.image_url || '');
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce jeu ?')) return;

    try {
      await adminApi.deleteGame(id);
      toast.success('Jeu supprimé !');
      loadGames();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <FaSpinner className="animate-spin text-4xl text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center space-x-3 gradient-text">
            <FaCog className="text-purple-400" />
            <span>Administration</span>
          </h1>
          <p className="text-gray-300">Gérez les jeux de la plateforme</p>
        </div>
        <button
          onClick={() => {
            setEditingGame(null);
            setFormData({
              title: '',
              description: '',
              genre: '',
              platform: '',
              releaseDate: '',
              imageUrl: '',
              imageBase64: '',
            });
            setPreviewImage('');
            setShowModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <FaPlus />
          <span>Ajouter un jeu</span>
        </button>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-purple-500/20">
                <th className="text-left py-3 px-4 font-semibold text-white">Titre</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Genre</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Plateforme</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Note moyenne</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-b border-purple-500/10 hover:bg-white/5">
                  <td className="py-3 px-4 text-white">{game.title}</td>
                  <td className="py-3 px-4 text-gray-300">{game.genre || '-'}</td>
                  <td className="py-3 px-4 text-gray-300">{game.platform || '-'}</td>
                  <td className="py-3 px-4 text-gray-300">
                    {(() => {
                      if (game.average_rating == null) return '-';
                      const rating = typeof game.average_rating === 'number' 
                        ? game.average_rating 
                        : (typeof game.average_rating === 'string' ? parseFloat(game.average_rating) : 0);
                      return !isNaN(rating) && isFinite(rating) && rating > 0 ? rating.toFixed(1) : '-';
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(game)}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(game.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 gradient-text">
              {editingGame ? 'Modifier le jeu' : 'Ajouter un jeu'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Titre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input h-24 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Plateforme
                  </label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Date de sortie
                  </label>
                  <input
                    type="date"
                    value={formData.releaseDate}
                    onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Mode de jeu
                  </label>
                  <select
                    value={formData.gameMode}
                    onChange={(e) => setFormData({ ...formData, gameMode: e.target.value })}
                    className="input"
                  >
                    <option value="solo">Solo</option>
                    <option value="multiplayer">Multijoueur</option>
                    <option value="both">Solo et Multijoueur</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    URL de l'image (optionnel)
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, imageUrl: e.target.value });
                      if (e.target.value) setPreviewImage(e.target.value);
                    }}
                    className="input"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Ou charger une image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setFormData({ ...formData, imageBase64: base64 });
                        setPreviewImage(base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="input"
                />
              </div>
              {previewImage && (
                <div className="mt-2">
                  <p className="text-sm text-gray-300 mb-2">Aperçu :</p>
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-32 h-48 object-cover rounded-lg"
                    onError={() => setPreviewImage('')}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  URL du trailer YouTube
                </label>
                <input
                  type="url"
                  value={formData.trailerUrl}
                  onChange={(e) => setFormData({ ...formData, trailerUrl: e.target.value })}
                  className="input"
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Vous pouvez utiliser n'importe quelle URL YouTube (watch, youtu.be, ou embed)
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingGame(null);
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingGame ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

