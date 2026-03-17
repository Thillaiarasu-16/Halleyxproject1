import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('halleyx_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? 'Unknown error';
    // If 401 and not on login page, redirect to login
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('halleyx_token');
      window.location.href = '/login';
    }
    console.error('[API Error]', message);
    return Promise.reject(new Error(message));
  }
);

export default api;
