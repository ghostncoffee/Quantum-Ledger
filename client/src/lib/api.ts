import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

// Helper to unwrap data
const get = (url: string, params?: Record<string, unknown>) => api.get(url, { params }).then(r => r.data);
const post = (url: string, data?: unknown) => api.post(url, data).then(r => r.data);
const put = (url: string, data?: unknown) => api.put(url, data).then(r => r.data);
const del = (url: string) => api.delete(url).then(r => r.data);

// Games
export const gamesApi = {
  list: () => get('/games'),
  create: (d: unknown) => post('/games', d),
  update: (id: number, d: unknown) => put(`/games/${id}`, d),
  remove: (id: number) => del(`/games/${id}`),
};

// Crew
export const crewApi = {
  list: (gameId?: number) => get('/crew', gameId ? { gameId } : undefined),
  get: (id: number) => get(`/crew/${id}`),
  create: (d: unknown) => post('/crew', d),
  update: (id: number, d: unknown) => put(`/crew/${id}`, d),
  remove: (id: number) => del(`/crew/${id}`),
};

// Vehicles
export const vehiclesApi = {
  list: (params?: Record<string, unknown>) => get('/vehicles', params),
  create: (d: unknown) => post('/vehicles', d),
  update: (id: number, d: unknown) => put(`/vehicles/${id}`, d),
  remove: (id: number) => del(`/vehicles/${id}`),
};

// Runs
export const runsApi = {
  list: (params?: Record<string, unknown>) => get('/runs', params),
  get: (id: number) => get(`/runs/${id}`),
  create: (d: unknown) => post('/runs', d),
  update: (id: number, d: unknown) => put(`/runs/${id}`, d),
  complete: (id: number) => post(`/runs/${id}/complete`),
  remove: (id: number) => del(`/runs/${id}`),
  getCrew: (id: number) => get(`/runs/${id}/crew`),
  addCrew: (id: number, d: unknown) => post(`/runs/${id}/crew`, d),
  updateCrew: (runId: number, crewId: number, d: unknown) => put(`/runs/${runId}/crew/${crewId}`, d),
  removeCrew: (runId: number, crewId: number) => del(`/runs/${runId}/crew/${crewId}`),
};

// Mining
export const miningApi = {
  getPipeline: (runId: number) => get(`/mining/run/${runId}`),
  addEntry: (d: unknown) => post('/mining/entries', d),
  updateEntry: (id: number, d: unknown) => put(`/mining/entries/${id}`, d),
  removeEntry: (id: number) => del(`/mining/entries/${id}`),
  addRefining: (d: unknown) => post('/mining/refining', d),
  updateRefining: (id: number, d: unknown) => put(`/mining/refining/${id}`, d),
  removeRefining: (id: number) => del(`/mining/refining/${id}`),
};

// Trading
export const tradingApi = {
  getForRun: (runId: number) => get(`/trading/run/${runId}`),
  create: (d: unknown) => post('/trading', d),
  update: (id: number, d: unknown) => put(`/trading/${id}`, d),
  remove: (id: number) => del(`/trading/${id}`),
};

// Sales
export const salesApi = {
  getForRun: (runId: number) => get(`/sales/run/${runId}`),
  create: (d: unknown) => post('/sales', d),
  update: (id: number, d: unknown) => put(`/sales/${id}`, d),
  remove: (id: number) => del(`/sales/${id}`),
};

// Crafting
export const craftingApi = {
  getForRun: (runId: number) => get(`/crafting/run/${runId}`),
  createJob: (d: unknown) => post('/crafting/jobs', d),
  updateJob: (id: number, d: unknown) => put(`/crafting/jobs/${id}`, d),
  removeJob: (id: number) => del(`/crafting/jobs/${id}`),
  addInput: (jobId: number, d: unknown) => post(`/crafting/jobs/${jobId}/inputs`, d),
  updateInput: (id: number, d: unknown) => put(`/crafting/inputs/${id}`, d),
  removeInput: (id: number) => del(`/crafting/inputs/${id}`),
};

// Hauling
export const haulingApi = {
  getForRun: (runId: number) => get(`/hauling/run/${runId}`),
  create: (d: unknown) => post('/hauling', d),
  update: (id: number, d: unknown) => put(`/hauling/${id}`, d),
  remove: (id: number) => del(`/hauling/${id}`),
};

// Contracts
export const contractsApi = {
  list: (params?: Record<string, unknown>) => get('/contracts', params),
  getForRun: (runId: number) => get(`/contracts/run/${runId}`),
  create: (d: unknown) => post('/contracts', d),
  update: (id: number, d: unknown) => put(`/contracts/${id}`, d),
  complete: (id: number, d?: unknown) => post(`/contracts/${id}/complete`, d),
  remove: (id: number) => del(`/contracts/${id}`),
};

// Expenses
export const expensesApi = {
  list: (params?: Record<string, unknown>) => get('/expenses', params),
  create: (d: unknown) => post('/expenses', d),
  update: (id: number, d: unknown) => put(`/expenses/${id}`, d),
  remove: (id: number) => del(`/expenses/${id}`),
};

// Inventory
export const inventoryApi = {
  list: (params?: Record<string, unknown>) => get('/inventory', params),
  create: (d: unknown) => post('/inventory', d),
  adjust: (id: number, d: unknown) => post(`/inventory/${id}/adjust`, d),
  sell: (id: number, d: unknown) => post(`/inventory/${id}/sell`, d),
  getTransactions: (id: number) => get(`/inventory/${id}/transactions`),
  update: (id: number, d: unknown) => put(`/inventory/${id}`, d),
  remove: (id: number) => del(`/inventory/${id}`),
};

// Locations
export const locationsApi = {
  list: (params?: Record<string, unknown>) => get('/locations', params),
};

// Accounting / Ledger
export const accountingApi = {
  list: (params?: Record<string, unknown>) => get('/accounting', params),
  summary: (params?: Record<string, unknown>) => get('/accounting/summary', params),
  breakdown: (params?: Record<string, unknown>) => get('/accounting/breakdown', params),
  runsReport: (params?: Record<string, unknown>) => get('/accounting/runs', params),
  create: (d: unknown) => post('/accounting', d),
  update: (id: number, d: unknown) => put(`/accounting/${id}`, d),
  remove: (id: number) => del(`/accounting/${id}`),
};
