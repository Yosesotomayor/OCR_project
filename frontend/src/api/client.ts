import { client } from '../client/client.gen';
import { refreshToken } from '../client/sdk.gen';

client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

client.interceptors.request.use((request) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

client.interceptors.response.use(async (response, request, opts) => {
  if (response.status === 401 && !request.url.includes('/auth/refresh') && !request.url.includes('/auth/login')) {
    const refresh_token = localStorage.getItem('refresh_token');

    if (!refresh_token) {
      return response;
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          opts.headers.set('Authorization', `Bearer ${token}`);
          return client.request(opts);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    isRefreshing = true;

    try {
      const { data, error } = await refreshToken({
        query: { refresh_token }
      });

      if (error || !data) {
        throw error || new Error('Failed to refresh token');
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      processQueue(null, data.access_token);

      // Retry the original request with new token
      opts.headers.set('Authorization', `Bearer ${data.access_token}`);
      return client.request(opts);
    } catch (err) {
      processQueue(err, null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      // Clear all state and redirect to login
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }

  return response;
});

export { client };
