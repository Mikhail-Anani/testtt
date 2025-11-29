import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaUserPlus } from 'react-icons/fa';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
      toast.success('Inscription réussie ! Bienvenue !');
      navigate('/');
    } catch (error: any) {
      if (error.response?.status === 429) {
        toast.error('Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.');
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Erreur lors de l\'inscription';
        toast.error(errorMessage);
      }
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <FaUserPlus className="text-2xl text-white" />
          </div>
          <h2 className="text-3xl font-bold gradient-text">Inscription</h2>
          <p className="text-gray-300 mt-2">Créez votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Nom
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-300">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

