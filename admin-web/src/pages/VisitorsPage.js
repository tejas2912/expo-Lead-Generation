import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { visitorsAPI, adminAPI } from '../services/api';
import {
  UserGroupIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const VisitorsPage = () => {
  const { hasRole, hasAnyRole, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);

  // Fetch companies for Platform Admin dropdown
  const { data: companiesData } = useQuery(
    'companies',
    () => adminAPI.getCompanies(),
    {
      enabled: hasRole('platform_admin'),
    }
  );

  const companies = companiesData?.data?.companies || [];

  // Fetch visitors - different for platform admin vs company admin
  const { data: visitorsData, isLoading, error, isFetching } = useQuery(
    ['visitors', currentPage, search, user?.role, user?.company_id],
    async () => {
      if (hasRole('platform_admin')) {
        // Platform admin sees all visitors
        return visitorsAPI.list({ page: currentPage, search });
      } else if (hasRole('company_admin')) {
        // Company admin sees only their company's visitors
        return visitorsAPI.list({ page: currentPage, search, company_id: user?.company_id });
      }
      return { data: { visitors: [], pagination: {} } };
    },
    {
      enabled: hasAnyRole(['platform_admin', 'company_admin']),
      keepPreviousData: true,
      onSuccess: () => {
        queryClient.invalidateQueries('visitors');
      },
      onError: (error) => {
        console.error('Visitors API error:', error);
      }
    }
  );

  const visitors = visitorsData?.data?.visitors || [];
  const pagination = visitorsData?.data?.pagination || {};

  // Create visitor mutation
  const createVisitorMutation = useMutation(
    (visitorData) => {
      if (hasRole('platform_admin')) {
        // Platform admin can assign any company
        return visitorsAPI.create(visitorData);
      } else {
        // Company admin assigns to their own company
        return visitorsAPI.create({ ...visitorData, company_id: user?.company_id });
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('visitors');
        setShowAddForm(false);
        setEditingVisitor(null);
      },
    }
  );

  // Update visitor mutation
  const updateVisitorMutation = useMutation(
    ({ id, data }) => visitorsAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('visitors');
        setEditingVisitor(null);
      },
    }
  );

  // Delete visitor mutation
  const deleteVisitorMutation = useMutation(
    (id) => visitorsAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('visitors');
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
    if (editingVisitor) {
      updateVisitorMutation.mutate({ id: editingVisitor.id, data });
    } else {
      createVisitorMutation.mutate(data);
    }
  };

  const handleEdit = (visitor) => {
    setEditingVisitor(visitor);
    setShowAddForm(true);
    reset(visitor);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this visitor?')) {
      deleteVisitorMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingVisitor(null);
    setShowAddForm(true);
    reset({
      full_name: '',
      email: '',
      phone: '',
      organization: '',
      designation: '',
      city: '',
      country: '',
    });
  };

  const togglePasswordVisibility = (visitorId) => {
    setShowPassword(prev => ({
      ...prev,
      [visitorId]: !prev[visitorId]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
              {hasRole('platform_admin') ? 'Global Visitors Management' : 'Company Visitors Management'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasRole('platform_admin') 
                ? 'Manage all visitors across all companies' 
                : `Manage visitors for your company`}
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleAddNew}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Visitor
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitors by name, email, or phone..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Add/Edit Visitor Form */}
        {showAddForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingVisitor ? 'Edit Visitor' : 'Add New Visitor'}
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    Email
                  </label>
                  <input
                    {...register('email', {
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
                    Phone Number *
                  </label>
                  <input
                    {...register('phone', { required: 'Phone number is required' })}
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
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <input
                    {...register('organization')}
                    id="organization"
                    type="text"
                    className="input mt-1"
                    placeholder="Enter organization"
                  />
                  {errors.organization && (
                    <p className="mt-1 text-sm text-red-600">{errors.organization.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="designation" className="block text-sm font-medium text-gray-700">
                    Designation
                  </label>
                  <input
                    {...register('designation')}
                    id="designation"
                    type="text"
                    className="input mt-1"
                    placeholder="Enter designation"
                  />
                  {errors.designation && (
                    <p className="mt-1 text-sm text-red-600">{errors.designation.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    {...register('city')}
                    id="city"
                    type="text"
                    className="input mt-1"
                    placeholder="Enter city"
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <input
                    {...register('country')}
                    id="country"
                    type="text"
                    className="input mt-1"
                    placeholder="Enter country"
                  />
                  {errors.country && (
                    <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingVisitor(null);
                    reset();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVisitorMutation.isLoading || updateVisitorMutation.isLoading}
                  className="btn btn-primary"
                >
                  {createVisitorMutation.isLoading || updateVisitorMutation.isLoading
                    ? 'Saving...'
                    : editingVisitor
                    ? 'Update Visitor'
                    : 'Add Visitor'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Visitors Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-500">Loading visitors...</p>
            </div>
          ) : visitors.length === 0 ? (
            <div className="p-6 text-center">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No visitors</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasRole('platform_admin') 
                  ? 'No visitors found across all companies.'
                  : 'No visitors found for your company.'}
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
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visitors.map((visitor) => (
                    <tr key={visitor.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {visitor.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visitor.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visitor.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visitor.organization || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visitor.designation || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visitor.city && visitor.country ? `${visitor.city}, ${visitor.country}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(visitor)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(visitor.id)}
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

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(pagination.total_pages, currentPage + 1))}
                  disabled={currentPage >= pagination.total_pages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{pagination.total_pages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(pagination.total_pages, currentPage + 1))}
                      disabled={currentPage >= pagination.total_pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitorsPage;
