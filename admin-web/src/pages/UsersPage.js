import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import {
  UserGroupIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const UsersPage = () => {
  const { hasRole, hasAnyRole, user } = useAuth();
  console.log('🔍 Users Page - User:', user);
  console.log('🔍 Users Page - Has Platform Admin Role:', hasRole('platform_admin'));
  console.log('🔍 Users Page - Has Company Admin Role:', hasRole('company_admin'));
  console.log('🔍 Users Page - Has Any Admin Role:', hasAnyRole(['platform_admin', 'company_admin']));
  
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Fetch users - different for platform admin vs company admin
  const queryEnabled = hasAnyRole(['platform_admin', 'company_admin']);
  console.log('🔍 Users Page - Query Enabled:', queryEnabled);
  
  const { data: usersData, isLoading, error } = useQuery(
    ['users', currentPage, search, selectedRole],
    () => {
      const params = { page: currentPage, search };
      if (selectedRole) params.role = selectedRole;
      
      // For company admins, only show employees from their company
      if (hasRole('company_admin')) {
        params.role = 'employee'; // Only show employees
      }
      
      return adminAPI.getUsers(params);
    },
    {
      enabled: queryEnabled,
      keepPreviousData: true,
    }
  );
  
  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination || {};

  // Deactivate user mutation
  const deactivateUserMutation = useMutation(
    (id) => adminAPI.deactivateUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );

  // Create user mutation
  const createUserMutation = useMutation(
    (data) => adminAPI.createUser(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        setShowAddForm(false);
        reset();
      },
    }
  );

  // Update user mutation
  const updateUserMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        setShowAddForm(false);
        setEditingUser(null);
        reset();
      },
    }
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = (data) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    reset(user);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      deactivateUserMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setShowAddForm(true);
    reset({
      full_name: '',
      email: '',
      phone: '',
      role: '',
      company_id: '',
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'platform_admin':
        return 'bg-purple-100 text-purple-800';
      case 'company_admin':
        return 'bg-blue-100 text-blue-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'platform_admin':
        return 'Platform Admin';
      case 'company_admin':
        return 'Company Admin';
      case 'employee':
        return 'Employee';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
              {hasRole('platform_admin') ? 'Global Users Management' : 'Employee Management'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasRole('platform_admin') 
                ? 'Manage all users across all companies' 
                : 'Manage employees for your company'}
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleAddNew}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              {hasRole('platform_admin') ? 'Add User' : 'Add Employee'}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder={hasRole('platform_admin') ? 'Search users by name, email, or phone...' : 'Search employees by name, email, or phone...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Role Filter */}
          {hasRole('platform_admin') && (
            <div className="mt-4 flex space-x-4">
              <select
                className="input"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="platform_admin">Platform Admin</option>
                <option value="company_admin">Company Admin</option>
                <option value="employee">Employee</option>
              </select>
            </div>
          )}
        </div>

        {/* Add/Edit User Form */}
        {showAddForm && (
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                      Full Name *
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
                      Email *
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
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      {...register('phone')}
                      id="phone"
                      type="tel"
                      className="input mt-1"
                      placeholder="Enter phone number"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role *
                    </label>
                    <select
                      {...register('role', { required: 'Role is required' })}
                      id="role"
                      className="input mt-1"
                    >
                      <option value="">Select a role</option>
                      {hasRole('platform_admin') && (
                        <option value="platform_admin">Platform Admin</option>
                      )}
                      {hasRole('platform_admin') && (
                        <option value="company_admin">Company Admin</option>
                      )}
                      <option value="employee">Employee</option>
                    </select>
                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                    )}
                  </div>

                  {hasRole('platform_admin') && (
                    <div>
                      <label htmlFor="company_id" className="block text-sm font-medium text-gray-700">
                        Company
                      </label>
                      <select
                        {...register('company_id')}
                        id="company_id"
                        className="input mt-1"
                      >
                        <option value="">Select a company</option>
                        {/* This would need to be populated with companies list */}
                      </select>
                      {errors.company_id && (
                        <p className="mt-1 text-sm text-red-600">{errors.company_id.message}</p>
                      )}
                    </div>
                  )}

                  {!editingUser && (
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password *
                      </label>
                      <input
                        {...register('password', { 
                          required: 'Password is required',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters'
                          }
                        })}
                        id="password"
                        type="password"
                        className="input mt-1"
                        placeholder="Enter password"
                      />
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingUser(null);
                      reset();
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createUserMutation.isLoading || updateUserMutation.isLoading}
                  >
                    {createUserMutation.isLoading || updateUserMutation.isLoading ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-body">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-500">Loading users...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">Error loading users: {error.message}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {search ? 'Try adjusting your search criteria' : 'Get started by adding a new user'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      {hasRole('platform_admin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((userItem) => (
                      <tr key={userItem.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userItem.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userItem.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userItem.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(userItem.role)}`}>
                            {getRoleLabel(userItem.role)}
                          </span>
                        </td>
                        {hasRole('platform_admin') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {userItem.company_name || 'N/A'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => {
                            console.log('🔍 Status Display - User:', userItem);
                            console.log('🔍 Status Display - Role:', userItem.role);
                            console.log('🔍 Status Display - Company Status:', userItem.company_status);
                            console.log('🔍 Status Display - Is Active:', userItem.is_active);
                            
                            const isCompanyUser = userItem.role === 'company_admin' || userItem.role === 'employee';
                            const displayStatus = isCompanyUser 
                              ? (userItem.company_status || 'Active')
                              : (userItem.is_active ? 'Active' : 'Inactive');
                            
                            console.log('🔍 Status Display - Is Company User:', isCompanyUser);
                            console.log('🔍 Status Display - Final Status:', displayStatus);
                            
                            return (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                isCompanyUser 
                                  ? (userItem.company_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                                  : (userItem.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                              }`}>
                                {displayStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(userItem.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(userItem)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            {userItem.id !== user?.id && userItem.is_active && (
                              <button
                                onClick={() => handleDelete(userItem.id)}
                                className="text-red-600 hover:text-red-900"
                                disabled={deactivateUserMutation.isLoading}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.current_page - 1) * 50) + 1} to{' '}
                  {Math.min(pagination.current_page * 50, pagination.total_records)} of{' '}
                  {pagination.total_records} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(pagination.current_page - 1)}
                    disabled={!pagination.has_prev}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(pagination.current_page + 1)}
                    disabled={!pagination.has_next}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
