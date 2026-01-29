import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import {
  UserGroupIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const CompanyAdminsPage = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState({});
  const [editingAdmin, setEditingAdmin] = useState(null);

  // Fetch companies for dropdown
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useQuery(
    'companies',
    () => adminAPI.getCompanies(),
    {
      enabled: hasRole('platform_admin'),
      retry: 2,
    }
  );

  // Fetch company admins
  const { data: admins, isLoading: adminsLoading } = useQuery(
    'company-admins',
    () => adminAPI.getCompanyAdmins(),
    {
      enabled: hasRole('platform_admin'),
      onSuccess: (data) => console.log('🔍 Company admins data:', data),
      onError: (error) => console.error('🔍 Company admins error:', error),
    }
  );

  // Create company admin mutation
  const createAdminMutation = useMutation(
    (adminData) => adminAPI.createCompanyAdmin(adminData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('company-admins');
        queryClient.invalidateQueries('companies');
        reset();
      },
    }
  );

  // Update company admin mutation
  const updateAdminMutation = useMutation(
    ({ id, data }) => adminAPI.updateCompanyAdmin(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('company-admins');
        setEditingAdmin(null);
        reset();
      },
    }
  );

  // Delete company admin mutation
  const deleteAdminMutation = useMutation(
    (id) => adminAPI.deleteCompanyAdmin(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('company-admins');
      },
    }
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      mobile: '',
      password: '',
      company_id: ''
    }
  });

  // Reset form to empty values on component mount
  React.useEffect(() => {
    reset({
      full_name: '',
      email: '',
      mobile: '',
      password: '',
      company_id: ''
    });
  }, [reset]);

  const onSubmit = (data) => {
    console.log('🔍 Form submission data:', data);
    console.log('🔍 Data types:', {
      full_name: typeof data.full_name,
      email: typeof data.email,
      mobile: typeof data.mobile,
      password: typeof data.password,
      company_id: typeof data.company_id
    });
    console.log('🔍 Company ID value:', data.company_id);
    createAdminMutation.mutate(data);
  };

  const onEditSubmit = (data) => {
    updateAdminMutation.mutate({ id: editingAdmin.id, data });
  };

  const togglePasswordVisibility = (adminId) => {
    setShowPassword(prev => ({
      ...prev,
      [adminId]: !prev[adminId],
    }));
  };

  if (!hasRole('platform_admin')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
            Company Admins Management
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Create Company Admin Form */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Company Admin</h3>
            <form key="company-admin-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  {...register('full_name', { required: 'Full name is required' })}
                  id="full_name"
                  type="text"
                  className="input mt-1"
                  placeholder="Enter full name"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  id="email"
                  type="email"
                  className="input mt-1"
                  placeholder="Enter email"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="edit_mobile" className="block text-sm font-medium text-gray-700">
                  Mobile Number
                </label>
                <input
                  {...register('mobile')}
                  id="edit_mobile"
                  type="tel"
                  className="input mt-1"
                  defaultValue={editingAdmin?.mobile || ''}
                />
                {errors.mobile && (
                  <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Temporary Password
                </label>
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  id="password"
                  type="password"
                  className="input mt-1"
                  placeholder="Enter temporary password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="company_id" className="block text-sm font-medium text-gray-700">
                  Company
                </label>
                {companiesLoading ? (
                  <div className="mt-1">
                    <select className="input" disabled>
                      <option>Loading companies...</option>
                    </select>
                  </div>
                ) : companiesError ? (
                  <div className="mt-1">
                    <select className="input border-red-300" disabled>
                      <option>Error loading companies</option>
                    </select>
                    <p className="mt-1 text-sm text-red-600">
                      Failed to load companies. Please refresh the page.
                    </p>
                  </div>
                ) : (
                  <select
                    {...register('company_id', { required: 'Company is required' })}
                    id="company_id"
                    className="input mt-1"
                  >
                    <option value="">Select a company</option>
                    {Array.isArray(companies?.data?.companies) && companies.data.companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.company_code})
                      </option>
                    ))}
                    {Array.isArray(companies?.companies) && companies.companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.company_code})
                      </option>
                    ))}
                    {Array.isArray(companies?.data) && companies.data.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.company_code})
                      </option>
                    ))}
                    {Array.isArray(companies) && companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.company_code})
                      </option>
                    ))}
                  </select>
                )}
                {errors.company_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.company_id.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={createAdminMutation.isLoading}
                className="w-full btn btn-primary"
              >
                {createAdminMutation.isLoading ? 'Creating...' : 'Create Company Admin'}
              </button>
            </form>
          </div>
        </div>

        {/* Company Admins List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Company Admins</h3>
              
              {adminsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(admins?.data?.data) && admins.data.data.map(admin => (
                        <tr key={admin.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {admin.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.company_name} ({admin.company_code})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => togglePasswordVisibility(admin.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showPassword[admin.id] ? (
                                  <EyeSlashIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingAdmin(admin)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAdminMutation.mutate(admin.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {Array.isArray(admins?.data) && admins.data.map(admin => (
                        <tr key={admin.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {admin.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.company_name} ({admin.company_code})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => togglePasswordVisibility(admin.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showPassword[admin.id] ? (
                                  <EyeSlashIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingAdmin(admin)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAdminMutation.mutate(admin.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {Array.isArray(admins?.admins) && admins.admins.map(admin => (
                        <tr key={admin.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {admin.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.company_name} ({admin.company_code})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => togglePasswordVisibility(admin.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showPassword[admin.id] ? (
                                  <EyeSlashIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingAdmin(admin)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAdminMutation.mutate(admin.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {Array.isArray(admins) && admins.map(admin => (
                        <tr key={admin.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {admin.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admin.company_name} ({admin.company_code})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => togglePasswordVisibility(admin.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showPassword[admin.id] ? (
                                  <EyeSlashIcon className="h-4 w-4" />
                                ) : (
                                  <EyeIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingAdmin(admin)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAdminMutation.mutate(admin.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Company Admin</h3>
            <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
              <input type="hidden" {...register('id')} value={editingAdmin.id} />
              
              <div>
                <label htmlFor="edit_full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  {...register('full_name', { required: 'Full name is required' })}
                  id="edit_full_name"
                  type="text"
                  className="input mt-1"
                  defaultValue={editingAdmin.full_name}
                />
              </div>

              <div>
                <label htmlFor="edit_email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  id="edit_email"
                  type="email"
                  className="input mt-1"
                  defaultValue={editingAdmin.email}
                />
              </div>

              <div>
                <label htmlFor="edit_is_active" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  {...register('is_active')}
                  id="edit_is_active"
                  className="input mt-1"
                  defaultValue={editingAdmin.is_active}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={updateAdminMutation.isLoading}
                  className="btn btn-primary"
                >
                  {updateAdminMutation.isLoading ? 'Updating...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAdminsPage;
