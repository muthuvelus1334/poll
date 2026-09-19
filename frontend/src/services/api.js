// Clean and normalize base URL to prevent double slashes or accidental /api duplications
function getCleanApiBase() {
  let url = (import.meta.env.VITE_API_URL || '').trim();
  if (!url) {
    return 'http://localhost:8080';
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api$/, '');
  return url;
}

function getCleanWsBase() {
  let url = (import.meta.env.VITE_WS_URL || '').trim();
  if (!url) {
    const apiBase = getCleanApiBase();
    if (apiBase.startsWith('http')) {
      return apiBase.replace(/^http/, 'ws');
    }
    return 'ws://localhost:8080';
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api$/, '');
  return url;
}

const API_BASE = getCleanApiBase();
export const WS_BASE = getCleanWsBase();

// Generate or retrieve persistent anonymous voter fingerprint
export const getVoterFingerprint = () => {
  let fp = localStorage.getItem('voter_fingerprint');
  if (!fp) {
    fp = 'voter_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('voter_fingerprint', fp);
  }
  return fp;
};

// Generic request helper
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    'X-Voter-Fingerprint': getVoterFingerprint(),
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/api/auth/me', { method: 'GET' }),

  // Polls
  createPoll: (payload) => request('/api/polls', { method: 'POST', body: JSON.stringify(payload) }),
  getPoll: (id) => request(`/api/polls/${id}`, { method: 'GET' }),
  listMyPolls: () => request('/api/polls', { method: 'GET' }),
  setPollStatus: (id, isActive) => request(`/api/polls/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deletePoll: (id) => request(`/api/polls/${id}`, { method: 'DELETE' }),

  // Voting & Results
  castVote: (pollId, optionId) => request(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({
      optionId,
      voterFingerprint: getVoterFingerprint(),
    }),
  }),
  getLiveResults: (pollId) => request(`/api/polls/${pollId}/results`, { method: 'GET' }),
};
