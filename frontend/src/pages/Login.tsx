import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaSignInAlt } from 'react-icons/fa';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Connexion réussie ! Bienvenue !');
      navigate('/');
    } catch (error: any) {
      if (error.response?.status === 429) {
        toast.error('Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.');
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Erreur de connexion';
        toast.error(errorMessage);
      }
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <FaSignInAlt className="text-2xl text-white" />
          </div>
          <h2 className="text-3xl font-bold gradient-text">Connexion</h2>
          <p className="text-gray-300 mt-2">Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-300">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}

