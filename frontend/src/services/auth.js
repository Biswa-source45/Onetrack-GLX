const BASE_URL = '';

// Token storage helpers
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('onetrack_access_token'),
  getRefreshToken: () => localStorage.getItem('onetrack_refresh_token'),
  getUser: () => {
    const userStr = localStorage.getItem('onetrack_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  setTokens: (accessToken, refreshToken, user) => {
    localStorage.setItem('onetrack_access_token', accessToken);
    localStorage.setItem('onetrack_refresh_token', refreshToken);
    if (user) {
      localStorage.setItem('onetrack_user', JSON.stringify(user));
    }
  },
  clear: () => {
    localStorage.removeItem('onetrack_access_token');
    localStorage.removeItem('onetrack_refresh_token');
    localStorage.removeItem('onetrack_user');
  }
};

let refreshPromise = null;

async function acquireRefreshLockOrWaitForCompletion(refreshToken) {
  const lockKey = 'onetrack_refresh_lock';
  const maxWait = 8000; // 8 seconds max wait
  const pollInterval = 200;
  let elapsed = 0;

  while (elapsed < maxWait) {
    const lockVal = localStorage.getItem(lockKey);
    const now = Date.now();

    if (lockVal) {
      let lockParsed = null;
      try {
        lockParsed = JSON.parse(lockVal);
      } catch (err) {
        break;
      }
      
      // If the lock is older than 8 seconds, consider it expired
      if (now - lockParsed.timestamp > 8000) {
        break;
      }

      // Check if access token has changed in the meantime
      const latestRefreshToken = tokenStorage.getRefreshToken();
      if (latestRefreshToken && latestRefreshToken !== refreshToken) {
        return { action: 'use_new_token', accessToken: tokenStorage.getAccessToken() };
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    } else {
      break;
    }
  }

  // Acquire the lock
  localStorage.setItem(lockKey, JSON.stringify({
    timestamp: Date.now(),
    tokenUsed: refreshToken
  }));
  return { action: 'perform_refresh' };
}

function releaseRefreshLock() {
  localStorage.removeItem('onetrack_refresh_lock');
}

// Custom lightweight api client with automatic token refreshing
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Add Bearer token if available
  const token = tokenStorage.getAccessToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers
  };

  let response = await fetch(url, fetchOptions);

  // If response is 401 Unauthorized, try to refresh token
  if (response.status === 401) {
    const currentToken = tokenStorage.getAccessToken();
    const originalToken = headers['Authorization']?.replace('Bearer ', '');

    // If another concurrent request already refreshed the token, retry immediately
    if (currentToken && currentToken !== originalToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
      response = await fetch(url, fetchOptions);
      return response;
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        const lockResult = await acquireRefreshLockOrWaitForCompletion(refreshToken);

        if (lockResult.action === 'use_new_token') {
          headers['Authorization'] = `Bearer ${lockResult.accessToken}`;
          response = await fetch(url, fetchOptions);
          return response;
        }

        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const refreshResponse = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
              });

              if (refreshResponse.ok) {
                const resData = await refreshResponse.json();
                if (resData.success && resData.data) {
                  const { access_token, refresh_token, user } = resData.data;
                  tokenStorage.setTokens(access_token, refresh_token, user);
                  return access_token;
                }
              }
              throw new Error('Token refresh failed');
            } finally {
              releaseRefreshLock();
            }
          })();
        }

        try {
          const newAccessToken = await refreshPromise;
          // Retry the original request with the new access token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, fetchOptions);
        } catch (err) {
          const latestRefreshToken = tokenStorage.getRefreshToken();
          const latestAccessToken = tokenStorage.getAccessToken();
          if (latestRefreshToken && latestRefreshToken !== refreshToken) {
            headers['Authorization'] = `Bearer ${latestAccessToken}`;
            response = await fetch(url, fetchOptions);
          } else {
            tokenStorage.clear();
            window.location.reload();
          }
        } finally {
          refreshPromise = null;
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        tokenStorage.clear();
        window.location.reload();
      }
    }
  }

  return response;
}

// Auth API Endpoints
export const authService = {
  healthCheck: async () => {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch (err) {
      return { status: 'unhealthy', error: err.message };
    }
  },

  login: async (username, password) => {
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      const { access_token, refresh_token, user } = data.data;
      tokenStorage.setTokens(access_token, refresh_token, user);
    }
    
    return { ok: response.ok, status: response.status, ...data };
  },

  logout: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    const token = tokenStorage.getAccessToken();
    
    let resData = { success: true };
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      resData = await response.json();
    } catch (err) {
      console.warn('Network error during API logout, clearing local state anyway:', err);
    }
    
    tokenStorage.clear();
    return resData;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await apiFetch('/api/v1/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, ...data };
  }
};
