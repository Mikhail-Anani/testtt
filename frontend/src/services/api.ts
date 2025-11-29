import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      const url = error.config?.url || '';
      const publicRoutes =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/games') ||
        url.includes('/comments') ||
        url.includes('/ratings');
      
      if (token && !publicRoutes) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
  getMe: () => api.get('/auth/me'),
};

export const gamesApi = {
  getAll: (skipCache = false) => api.get('/games', { params: skipCache ? { skipCache: 'true' } : {} }),
  getById: (id: number) => api.get(`/games/${id}`),
  search: (query: string) => api.get(`/games/search/${query}`),
  getRecommendations: (id: number) => api.get(`/games/${id}/recommendations`),
};

export const ratingsApi = {
  getByGame: (gameId: number) => api.get(`/ratings/game/${gameId}`),
  getUserRating: (gameId: number) => api.get(`/ratings/game/${gameId}/user`),
  create: (gameId: number, rating: number) =>
    api.post('/ratings', { gameId, rating }),
  delete: (id: number) => api.delete(`/ratings/${id}`),
};

export const commentsApi = {
  getByGame: (gameId: number) => api.get(`/comments/game/${gameId}`),
  create: (gameId: number, content: string) =>
    api.post('/comments', { gameId, content }),
  update: (id: string, content: string) =>
    api.put(`/comments/${id}`, { content }),
  delete: (id: string) => api.delete(`/comments/${id}`),
};

export const userGamesApi = {
  getMyList: () => api.get('/user-games/my-list'),
  add: (gameId: number) => api.post('/user-games/add', { gameId }),
  remove: (gameId: number) => api.post('/user-games/remove', { gameId }),
};

export const adminApi = {
  createGame: (data: any) => api.post('/admin/games', data),
  updateGame: (id: number, data: any) => api.put(`/admin/games/${id}`, data),
  deleteGame: (id: number) => api.delete(`/admin/games/${id}`),
};

export default api;

