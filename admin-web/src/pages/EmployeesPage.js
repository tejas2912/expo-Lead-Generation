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

const EmployeesPage = () => {
  const { hasRole, hasAnyRole, user } = useAuth();
  console.log('🔍 Employees Page - User:', user);
  console.log('🔍 Employees Page - Has Company Admin Role:', hasRole('company_admin'));
  console.log('🔍 Employees Page - Has Any Admin Role:', hasAnyRole(['company_admin']));
  
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Show success message
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  // Fetch employees - only for company admins
  const queryEnabled = hasRole('company_admin');
  console.log('🔍 Employees Page - Query Enabled:', queryEnabled);
  
  const { data: usersData, isLoading, error } = useQuery(
    ['employees', currentPage, search],
    () => {
      const params = { page: currentPage, search, role: 'employee' }; // Only employees
      
      console.log('🔍 Fetching employees with params:', params);
      return adminAPI.getUsers(params);
    },
    {
      enabled: queryEnabled,
      keepPreviousData: true,
      onSuccess: (data) => {
        console.log('🔍 Employees API success:', data);
        console.log('🔍 Employees array:', data?.data?.users);
        console.log('🔍 Employees count:', data?.data?.users?.length);
      },
      onError: (error) => {
        console.error('🔍 Employees API error:', error);
      },
    }
  );

  const employees = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination || {};

  // Create employee mutation
  const createEmployeeMutation = useMutation(
    (data) => {
      return adminAPI.createUser(data);
    },
    {
      onSuccess: (response) => {
        showSuccessMessage('Employee created successfully!');
        queryClient.invalidateQueries(['employees']);
        setShowAddForm(false);
        reset();
      },
      onError: (error) => {
        console.error('Create employee error:', error);
      }
    }
  );

  // Update employee mutation
  const updateEmployeeMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('employees');
        setShowAddForm(false);
        setEditingUser(null);
        reset();
      },
    }
  );

  // Deactivate employee mutation
  const deactivateEmployeeMutation = useMutation(
    (id) => adminAPI.deactivateUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('employees');
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
      phone: '',
      role: 'employee', // Always employee for company admins
      password: '',
    }
  });

  // Reset form to empty values on component mount
  React.useEffect(() => {
    reset({
      full_name: '',
      email: '',
      phone: '',
      role: 'employee',
      password: '',
    });
  }, [reset]);

  const onSubmit = (data) => {
    if (editingUser) {
      // Update existing employee
      updateEmployeeMutation.mutate({ id: editingUser.id, data });
    } else {
      // Create new employee
      const employeeData = {
        ...data,
        company_id: user.company_id // Auto-assign company admin's company
      };
      createEmployeeMutation.mutate(employeeData);
    }
  };

  const handleEdit = (employee) => {
    setEditingUser(employee);
    reset({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
    });
    setShowAddForm(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setShowAddForm(true);
    reset({
      full_name: '',
      email: '',
      phone: '',
      role: 'employee',
      password: '',
    });
  };

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation(
    (employeeId) => adminAPI.deleteUser(employeeId),
    {
      onSuccess: (data) => {
        showSuccessMessage('Employee deleted successfully');
        queryClient.invalidateQueries('employees');
        queryClient.invalidateQueries(['stats', 'dashboard']);
      },
      onError: (error) => {
        console.error('Delete employee error:', error);
        alert('Failed to delete employee: ' + (error.response?.data?.error || error.message));
      },
    }
  );

  // Handle delete employee
  const handleDeleteEmployee = (employeeId) => {
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      deleteEmployeeMutation.mutate(employeeId);
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L10 10.586z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
              Employee Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage employees for your company
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleAddNew}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder="Search employees by name, email, or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Add/Edit Employee Form */}
        {showAddForm && (
          <>
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    {...register('phone', { 
                      required: 'Mobile number is required',
                      pattern: {
                        value: /^[0-9]{10}$/,
                        message: 'Please enter a valid 10-digit mobile number'
                      }
                    })}
                    className={`input mt-1 ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="Enter mobile number"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

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
                          message: 'Password must be at least 6 characters',
                        },
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

                <div className="flex justify-end space-x-3 pt-4">
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
                    disabled={createEmployeeMutation.isLoading || updateEmployeeMutation.isLoading}
                  >
                    {editingUser ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          </>
        )}

        {/* Employees Table */}
        <div className="card">
          <div className="card-body">
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
                      Mobile
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
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={!employee.is_active}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;
