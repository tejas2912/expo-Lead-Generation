import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { leadsAPI, visitorsAPI, adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const LeadsPage = () => {
  const { hasRole } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [visitorSearchPhone, setVisitorSearchPhone] = useState('');
  
  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch companies for Platform Admin dropdown
  const { data: companiesData } = useQuery(
    'companies',
    () => adminAPI.getCompanies(),
    {
      enabled: hasRole('platform_admin'),
    }
  );

  // Fetch employees for Company Admin dropdown
  const { data: employeesData } = useQuery(
    'employees',
    () => adminAPI.getEmployees(),
    {
      enabled: hasRole('company_admin'),
    }
  );

  const companies = companiesData?.data?.companies || [];
  const employees = employeesData?.data?.employees || [];

  // Fetch leads with filters
  const { data: leadsData, isLoading } = useQuery(
    ['leads', { 
      page, 
      search: searchTerm,
      date_from: dateFrom,
      date_to: dateTo,
      employee_id: selectedEmployee,
      company_id: selectedCompany
    }],
    () => leadsAPI.list({ 
      page, 
      search: searchTerm,
      date_from: dateFrom,
      date_to: dateTo,
      employee_id: selectedEmployee,
      company_id: selectedCompany
    }),
    {
      keepPreviousData: true,
    }
  );

  // Update lead mutation
  const updateMutation = useMutation(
    ({ id, data }) => leadsAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leads');
        setShowCreateModal(false);
        setEditingLead(null);
        alert('Lead updated successfully!');
      },
      onError: (error) => {
        console.error('Lead update error:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
        let errorMessage = 'Failed to update lead';
        
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
        
        alert(`Error: ${errorMessage}`);
      },
    }
  );

  // Delete lead mutation (admin only)
  const deleteMutation = useMutation(leadsAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('leads');
    },
  });

  // Create lead mutation
  const createMutation = useMutation(leadsAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('leads');
      setShowCreateModal(false);
      setEditingLead(null);
      setSelectedVisitor(null);
      setVisitorSearchPhone('');
      alert('Lead created successfully!');
    },
    onError: (error) => {
      console.error('Lead creation error:', error);
      console.error('Error response:', error.response?.data);
      let errorMessage = 'Failed to create lead';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      alert(`Error: ${errorMessage}`);
    },
  });

  // Search visitor mutation
  const searchVisitorMutation = useMutation(visitorsAPI.search);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm();

  const handleSearchVisitor = async () => {
    if (visitorSearchPhone.length < 3) return;
    
    try {
      const response = await searchVisitorMutation.mutateAsync(visitorSearchPhone);
      const visitors = response.data.visitors;
      
      if (visitors.length > 0) {
        // Visitor found - autofill form
        setSelectedVisitor(visitors[0]);
        setValue('visitor_id', visitors[0].id);
        setValue('phone', visitors[0].phone);
        setValue('full_name', visitors[0].full_name || '');
        setValue('email', visitors[0].email || '');
        setValue('organization', visitors[0].organization || '');
        setValue('designation', visitors[0].designation || '');
        setValue('city', visitors[0].city || '');
        setValue('country', visitors[0].country || '');
        setValue('interests', visitors[0].interests || '');
      } else {
        // Visitor not found - allow manual entry
        setSelectedVisitor(null);
        setValue('visitor_id', '');
        setValue('phone', visitorSearchPhone); // Pre-fill phone from search
        setValue('full_name', '');
        setValue('email', '');
        setValue('organization', '');
        setValue('designation', '');
        setValue('city', '');
        setValue('country', '');
        setValue('interests', '');
      }
    } catch (error) {
      console.error('Error searching visitor:', error);
    }
  };

  const handleCreateLead = (data) => {
    if (editingLead) {
      // For updates, prepare data with role-based logic
      let updateData = { ...data };
      
      // Remove company_id for non-Platform Admin updates
      if (!hasRole('platform_admin')) {
        const { company_id, ...dataWithoutCompanyId } = updateData;
        updateData = dataWithoutCompanyId;
      }
      
      updateMutation.mutate({ id: editingLead.id, data: updateData });
    } else {
      // For new leads, include visitor details if visitor_id is not present
      let leadData = {
        ...data,
        // If visitor_id exists, use existing visitor
        // If not, backend will create new visitor with provided details
      };
      
      // Remove company_id for Company Admin (backend will use user's company)
      if (!hasRole('platform_admin')) {
        const { company_id, ...dataWithoutCompanyId } = leadData;
        leadData = dataWithoutCompanyId;
      }
      
      console.log('🔍 Lead creation data:', leadData);
      console.log('🔍 Visitor ID:', leadData.visitor_id);
      console.log('🔍 Phone:', leadData.phone);
      console.log('🔍 Full Name:', leadData.full_name);
      
      createMutation.mutate(leadData);
    }
  };

  const handleEdit = (lead) => {
    console.log('🔍 Editing lead data:', lead);
    console.log('🔍 Lead organization:', lead.organization);
    console.log('🔍 Lead visitor_organization:', lead.visitor_organization);
    console.log('🔍 Lead interests:', lead.interests);
    console.log('🔍 Lead follow_up_date:', lead.follow_up_date);
    
    setEditingLead(lead);
    reset({
      // Use visitor fields from the joined query, handle null values
      ...(hasRole('platform_admin') && { company_id: lead.company_id || '' }),
      organization: lead.organization || lead.visitor_organization || '',
      designation: lead.designation || lead.visitor_designation || '',
      city: lead.city || lead.visitor_city || '',
      country: lead.country || lead.visitor_country || '',
      interests: lead.interests || '', // Convert null to empty string
      notes: lead.notes || '',
      follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().split('T')[0] : '', // Convert null to empty string
    });
    setShowCreateModal(true);
  };

  const handleDelete = (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      deleteMutation.mutate(leadId);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  // Export handlers
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(selectedEmployee && { employee_id: selectedEmployee }),
        ...(selectedCompany && { company_id: selectedCompany }),
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/leads/export/csv?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const errorText = await response.text();
        console.error('Export response:', errorText);
        alert('Failed to export CSV: ' + (response.statusText || 'Unknown error'));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export CSV');
    }
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedEmployee('');
    setSelectedCompany('');
    setSearchTerm('');
    setPage(1);
  };

  const leads = leadsData?.data?.leads || [];
  const pagination = leadsData?.data?.pagination || {};

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="mt-2 text-gray-600">Manage visitor leads and follow-ups</p>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingLead(null);
              reset({
                visitor_id: '',
                phone: '',
                full_name: '',
                email: '',
                organization: '',
                designation: '',
                city: '',
                country: '',
                interests: '',
                notes: '',
                follow_up_date: '',
                ...(hasRole('platform_admin') && { company_id: '' })
              });
              setSelectedVisitor(null);
              setVisitorSearchPhone('');
              setShowCreateModal(true);
            }}
          >
            <UserPlusIcon className="h-4 w-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters and Export Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Date Range Filters */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">From Date</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">To Date</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Employee/Company Filters */}
          {hasRole('platform_admin') && (
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">Company</label>
              <select
                className="input"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasRole('company_admin') && (
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">Employee</label>
              <select
                className="input"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search and Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Total Count */}
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-blue-900">
                Total Leads: <span className="text-2xl font-bold text-blue-600">{leadsData?.data?.total_count || 0}</span>
              </h2>
              <p className="text-sm text-blue-700">
                {dateFrom || dateTo || selectedEmployee || selectedCompany || searchTerm ? 'Filtered results' : 'All leads from your company'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Visitor</th>
                <th className="table-header-cell">Organization</th>
                <th className="table-header-cell">Interests</th>
                <th className="table-header-cell">Notes</th>
                <th className="table-header-cell">Follow-up</th>
                <th className="table-header-cell">Created</th>
                <th className="table-header-cell">Captured By</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="table-cell text-center">
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-cell text-center text-gray-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.visitor_name}</div>
                        <div className="text-sm text-gray-500">{lead.visitor_phone}</div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="text-sm text-gray-900">{lead.organization || '-'}</div>
                    </td>
                    <td className="table-cell">
                      {lead.interests ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          lead.interests === 'Hot' ? 'bg-red-100 text-red-800' :
                          lead.interests === 'Warm' ? 'bg-yellow-100 text-yellow-800' :
                          lead.interests === 'Cold' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.interests}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.notes || ''}>
                        {lead.notes || '-'}
                      </div>
                    </td>
                    <td className="table-cell">
                      {lead.follow_up_date ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {new Date(lead.follow_up_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(lead.follow_up_date) >= new Date() ? 'Upcoming' : 'Overdue'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Not set</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="text-sm text-gray-900">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="text-sm text-gray-900">{lead.employee_name}</div>
                        <div className="text-sm text-gray-500">{lead.employee_email}</div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(lead)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {(hasRole('platform_admin') || hasRole('company_admin')) && (
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.has_prev}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.has_next}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * 50 + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(page * 50, pagination.total_records)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total_records}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={!pagination.has_prev}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      {page} of {pagination.total_pages}
                    </span>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={!pagination.has_next}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <Modal
          title={editingLead ? 'Edit Lead' : 'Create Lead'}
          onClose={() => {
            setShowCreateModal(false);
            setEditingLead(null);
            reset();
            setSelectedVisitor(null);
            setVisitorSearchPhone('');
          }}
        >
          <form onSubmit={handleSubmit(handleCreateLead)}>
            <div className="space-y-4">
              {!editingLead && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Search Visitor by Phone</label>
                  <div className="mt-1 flex space-x-2">
                    <input
                      type="tel"
                      className="input flex-1"
                      placeholder="Enter phone number"
                      value={visitorSearchPhone}
                      onChange={(e) => setVisitorSearchPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      maxLength={10}
                    />
                    <button
                      type="button"
                      onClick={handleSearchVisitor}
                      disabled={searchVisitorMutation.isLoading}
                      className="btn btn-secondary"
                    >
                      Search
                    </button>
                  </div>
                  
                  {selectedVisitor && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm font-medium text-green-800">Visitor Found</p>
                      <p className="text-sm text-green-700">{selectedVisitor.full_name} - {selectedVisitor.phone}</p>
                    </div>
                  )}
                  
                  {!selectedVisitor && visitorSearchPhone && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm font-medium text-yellow-800">New Visitor</p>
                      <p className="text-sm text-yellow-700">Please fill in visitor details below</p>
                    </div>
                  )}
                  
                  <input type="hidden" {...register('visitor_id')} />
                </div>
              )}

              {/* Visitor Information - Always show for new visitors */}
              {!editingLead && (!selectedVisitor || !visitorSearchPhone) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Visitor Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="tel"
                        className="input mt-1 bg-gray-50"
                        placeholder="Phone number"
                        {...register('phone', { 
                          required: 'Phone number is required',
                          pattern: {
                            value: /^[6-9]\d{9}$/,
                            message: 'Please enter a valid 10-digit phone number starting with 6-9'
                          },
                          minLength: {
                            value: 10,
                            message: 'Phone number must be exactly 10 digits'
                          },
                          maxLength: {
                            value: 10,
                            message: 'Phone number must be exactly 10 digits'
                          }
                        })}
                        disabled={!!selectedVisitor} // Only disabled when visitor is found
                        maxLength={10}
                        minLength={10}
                        onInput={(e) => {
                          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        }}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="Full name"
                        {...register('full_name', { required: 'Full name is required' })}
                        disabled={!!selectedVisitor}
                      />
                      {errors.full_name && (
                        <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        className="input mt-1"
                        placeholder="Email address"
                        {...register('email')}
                        disabled={!!selectedVisitor}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Organization</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="Organization"
                        {...register('organization')}
                        disabled={!!selectedVisitor}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Designation</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="Designation"
                        {...register('designation')}
                        disabled={!!selectedVisitor}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="City"
                        {...register('city')}
                        disabled={!!selectedVisitor}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Country</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="Country"
                        {...register('country')}
                        disabled={!!selectedVisitor}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Lead Information */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Lead Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {hasRole('platform_admin') && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Company *</label>
                      <select
                        {...register('company_id', { required: 'Company is required for platform admin' })}
                        className="input mt-1"
                      >
                        <option value="">Select Company</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      {errors.company_id && (
                        <p className="mt-1 text-sm text-red-600">{errors.company_id.message}</p>
                      )}
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Interest Level</label>
                    <select
                      {...register('interests')}
                      className="input mt-1"
                    >
                      <option value="">Select Interest Level</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="input mt-1"
                      placeholder="Detailed notes about this lead interaction..."
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Follow-up Date</label>
                    <input
                      {...register('follow_up_date')}
                      type="date"
                      className="input mt-1"
                    />
                  </div>
                  {/* Priority and tags fields temporarily removed - DB columns don't exist */}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingLead(null);
                  reset();
                  setSelectedVisitor(null);
                  setVisitorSearchPhone('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isLoading || updateMutation.isLoading}
                className="btn btn-primary"
              >
                {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : editingLead ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// Modal Component
const Modal = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadsPage;
