const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

/**
 * Standard fetch REST client for centralized backend operations.
 */
export const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };

  // Auto-inject JWT Bearer authorization if token is active
  const activeToken = token || localStorage.getItem('quantum_token');
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error with status code: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API CALL EXCEPTION] URL: ${url}`, error);
    throw error;
  }
};
