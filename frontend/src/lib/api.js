const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drlex.wapify.com.br';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('drlex_token');
}

function setToken(token) {
  localStorage.setItem('drlex_token', token);
}

function clearToken() {
  localStorage.removeItem('drlex_token');
  localStorage.removeItem('drlex_user');
}

function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('drlex_user');
  return raw ? JSON.parse(raw) : null;
}

function setUser(user) {
  localStorage.setItem('drlex_user', JSON.stringify(user));
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Não autenticado');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}

// Auth
export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.data.token);
  setUser(data.data.user);
  return data.data;
}

export async function register(name, email, password, whatsapp) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, whatsapp }),
  });
  setToken(data.data.token);
  setUser(data.data.user);
  return data.data;
}

export async function getMe() {
  const data = await request('/api/auth/me');
  return data.data;
}

export function logout() {
  clearToken();
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!getToken();
}

// Contratos
export async function analyzeContract(text, title) {
  const data = await request('/api/contracts/analyze', {
    method: 'POST',
    body: JSON.stringify({ text, title }),
  });
  return data.data || data;
}

export async function getContracts() {
  const me = getUser();
  if (!me) throw new Error('Não autenticado');
  const data = await request(`/api/contracts/${me.id}`);
  return data.data || [];
}

// Prazos
export async function createDeadline(deadline) {
  const data = await request('/api/deadlines', {
    method: 'POST',
    body: JSON.stringify(deadline),
  });
  return data.data || data;
}

export async function getDeadlines() {
  const me = getUser();
  if (!me) throw new Error('Não autenticado');
  const data = await request(`/api/deadlines/${me.id}`);
  return data.data || [];
}

export async function calculateDeadline(params) {
  const data = await request('/api/deadlines/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.data || data;
}

export async function getCPCDeadlines() {
  const data = await request('/api/deadlines/tipos/cpc');
  return data.data || [];
}

// Diários
export async function createMonitor(monitor) {
  const data = await request('/api/diarios/monitor', {
    method: 'POST',
    body: JSON.stringify(monitor),
  });
  return data.data || data;
}

export async function getMonitors() {
  const me = getUser();
  if (!me) throw new Error('Não autenticado');
  const data = await request(`/api/diarios/monitors/${me.id}`);
  return data.data || [];
}

export async function searchDiario(params) {
  const data = await request('/api/diarios/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.data || data;
}

// Chat
export async function chat(message) {
  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  return data.data || data;
}

export { getToken, getUser, clearToken };
