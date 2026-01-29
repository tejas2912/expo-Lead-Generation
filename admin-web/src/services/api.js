import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Visitors API
export const visitorsAPI = {
  search: (phone) => api.get(`/visitors/search/${phone}`),
  getById: (id) => api.get(`/visitors/${id}`),
  create: (data) => api.post('/visitors', data),
  update: (id, data) => api.put(`/visitors/${id}`, data),
  list: (params) => api.get('/visitors', { params }),
  getStats: () => api.get('/visitors/stats/overview'),
};

// Leads API
export const leadsAPI = {
  create: (data) => api.post('/leads', data),
  getById: (id) => api.get(`/leads/${id}`),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  list: (params) => api.get('/leads', { params }),
  getStats: () => api.get('/leads/stats/overview'),
};

// Users API
export const usersAPI = {
  getUsers: (params) => api.get('/users', { params }),
  deactivateUser: (id) => api.put(`/users/${id}/deactivate`),
  getUsersByRole: (role) => api.get(`/users?role=${role}`),
};

// Admin API
export const adminAPI = {
  getCompanies: (params) => api.get('/admin/companies', { params }),
  createCompany: (data) => api.post('/admin/companies', data),
  updateCompany: (id, data) => api.put(`/admin/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/admin/companies/${id}`),
  getCompanyAdmins: (params) => api.get('/admin/company-admins', { params }),
  createCompanyAdmin: (data) => api.post('/admin/company-admins', data),
  updateCompanyAdmin: (id, data) => api.put(`/admin/company-admins/${id}`, data),
  deleteCompanyAdmin: (id) => api.delete(`/admin/company-admins/${id}`),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/employees/${id}`),
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),
  getUsersByRole: (role) => api.get(`/admin/users?role=${role}`),
  getDashboard: () => api.get('/admin/dashboard/overview'),
  getCompanyDashboard: (companyId) => api.get('/admin/dashboard/company', { 
    params: companyId ? { company_id: companyId } : {} 
  }),
  getEmployeeDashboard: () => api.get('/admin/dashboard/employee'),
};

export default api;
