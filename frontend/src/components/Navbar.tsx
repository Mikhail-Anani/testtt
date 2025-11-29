import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaGamepad, FaUser, FaSignOutAlt, FaCog } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-purple-500/20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
              <FaGamepad className="text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">GameVault</span>
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/my-games"
                  className="text-white hover:text-purple-400 transition-colors hidden md:block"
                >
                  Ma Liste
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="text-white hover:text-purple-400 transition-colors flex items-center space-x-1 hidden md:flex"
                  >
                    <FaCog />
                    <span>Admin</span>
                  </Link>
                )}
                <div className="flex items-center space-x-2 text-white hidden md:flex">
                  <FaUser />
                  <span>{user.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-white hover:text-purple-400 transition-colors"
                >
                  <FaSignOutAlt />
                  <span className="hidden md:inline">Déconnexion</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-white hover:text-purple-400 transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

