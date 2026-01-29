import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import { adminAPI } from '../services/api';
import {
  UsersIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { hasRole } = useAuth();

  // Fetch dashboard data based on user role
  const { data: platformData, isLoading: platformLoading, error: platformError } = useQuery(
    'platform-dashboard',
    () => adminAPI.getDashboard(),
    {
      enabled: hasRole('platform_admin'),
      onSuccess: (data) => console.log('🔍 Platform Dashboard Data:', data),
      onError: (error) => console.error('🔍 Platform Dashboard Error:', error),
    }
  );

  const { data: companyData, isLoading: companyLoading, error: companyError } = useQuery(
    'company-dashboard',
    () => adminAPI.getCompanyDashboard(),
    {
      enabled: hasRole('company_admin'),
      onSuccess: (data) => console.log('🔍 Company Dashboard Data:', data),
      onError: (error) => console.error('🔍 Company Dashboard Error:', error),
    }
  );

  const { data: employeeData, isLoading: employeeLoading, error: employeeError } = useQuery(
    'employee-dashboard',
    () => adminAPI.getEmployeeDashboard(),
    {
      enabled: hasRole('employee'),
      onSuccess: (data) => console.log('🔍 Employee Dashboard Data:', data),
      onError: (error) => console.error('🔍 Employee Dashboard Error:', error),
    }
  );

  const isLoading = platformLoading || companyLoading || employeeLoading;
  const hasError = platformError || companyError || employeeError;

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Dashboard Error</h3>
          <p className="mt-2 text-gray-600">Failed to load dashboard data. Please try refreshing.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Platform Admin Dashboard
  if (hasRole('platform_admin')) {
    return <PlatformAdminDashboard data={platformData?.data} />;
  }

  // Company Admin Dashboard
  if (hasRole('company_admin')) {
    return <CompanyAdminDashboard data={companyData?.data} />;
  }

  // Employee Dashboard
  if (hasRole('employee')) {
    return <EmployeeDashboard data={employeeData?.data} />;
  }

  return <div>Dashboard not available for your role</div>;
};

// Platform Admin Dashboard Component
const PlatformAdminDashboard = ({ data }) => {
  const stats = data?.companies || {};
  const users = data?.users || {};
  const visitors = data?.visitors || {};
  const leads = data?.leads || {};

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="mt-2 text-gray-600">Overview of all companies and system statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Companies"
          value={stats.total || 0}
          subtitle={`${stats.active || 0} active`}
          icon={BuildingOfficeIcon}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={users.total || 0}
          subtitle={`${users.platform_admins || 0} admins, ${users.employees || 0} employees`}
          icon={UsersIcon}
          color="green"
        />
        <StatCard
          title="Total Visitors"
          value={visitors.total || 0}
          subtitle={`${visitors.last_30_days || 0} last 30 days`}
          icon={UserGroupIcon}
          color="purple"
        />
        <StatCard
          title="Total Leads"
          value={leads.total || 0}
          subtitle={`${leads.today || 0} today`}
          icon={ClipboardDocumentListIcon}
          color="yellow"
        />
      </div>

      {/* Recent Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="h-64 flex items-center justify-center text-gray-500">
              <ChartBarIcon className="h-12 w-12" />
              <span className="ml-2">Activity chart coming soon</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Health</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">API Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Database</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Last Sync</span>
                <span className="text-sm text-gray-600">Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Company Admin Dashboard Component
const CompanyAdminDashboard = ({ data }) => {
  const company = data?.company || {};
  const users = data?.users || {};
  const leads = data?.leads || {};
  const employeeStats = data?.employee_stats || [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
        <p className="mt-2 text-gray-600">
          {company.name} - Manage your company's visitor data and leads
        </p>
      </div>

      {/* Company Info */}
      <div className="card mb-8">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Company Name</p>
              <p className="text-lg font-semibold text-gray-900">{company.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Company Code</p>
              <p className="text-lg font-semibold text-gray-900">{company.company_code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Employees"
          value={users.employees || 0}
          subtitle="Active employees"
          icon={UsersIcon}
          color="blue"
        />
        <StatCard
          title="Total Leads"
          value={leads.total || 0}
          subtitle={`${leads.today || 0} today`}
          icon={ClipboardDocumentListIcon}
          color="green"
        />
        <StatCard
          title="Leads Last 30 Days"
          value={leads.last_30_days || 0}
          subtitle="Monthly activity"
          icon={ChartBarIcon}
          color="purple"
        />
        <StatCard
          title="Leads Today"
          value={leads.today || 0}
          subtitle="Daily activity"
          icon={CalendarIcon}
          color="yellow"
        />
      </div>

      {/* Employee Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Employee Performance</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {employeeStats.slice(0, 5).map((employee, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{employee.full_name}</p>
                    <p className="text-xs text-gray-500">{employee.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{employee.leads_count}</p>
                    <p className="text-xs text-gray-500">leads</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Leads</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {data?.recent_leads?.slice(0, 5).map((lead, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.visitor_name}</p>
                    <p className="text-xs text-gray-500">{lead.visitor_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{lead.employee_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Employee Dashboard Component
const EmployeeDashboard = ({ data }) => {
  const stats = data?.stats || {};
  const recentLeads = data?.recent_leads || [];
  const pendingFollowUps = data?.pending_follow_ups || [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
        <p className="mt-2 text-gray-600">Your visitor registration and lead management overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Leads"
          value={stats.total_leads || 0}
          subtitle="All time"
          icon={ClipboardDocumentListIcon}
          color="blue"
        />
        <StatCard
          title="Leads Today"
          value={stats.leads_today || 0}
          subtitle="Today's activity"
          icon={CalendarIcon}
          color="green"
        />
        <StatCard
          title="This Week"
          value={stats.leads_last_7_days || 0}
          subtitle="Last 7 days"
          icon={ChartBarIcon}
          color="purple"
        />
        <StatCard
          title="Pending Follow-ups"
          value={stats.pending_follow_ups || 0}
          subtitle="Need attention"
          icon={UsersIcon}
          color="yellow"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Leads</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {recentLeads.slice(0, 5).map((lead, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.visitor_name}</p>
                    <p className="text-xs text-gray-500">{lead.visitor_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(lead.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Pending Follow-ups</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {pendingFollowUps.slice(0, 5).map((lead, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.visitor_name}</p>
                    <p className="text-xs text-gray-500">{lead.visitor_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString() : 'No date set'}
                    </p>
                    <p className="text-xs text-gray-500">Follow-up</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-3 rounded-md ${colorClasses[color]} bg-opacity-10`}>
            <Icon className={`h-6 w-6 ${colorClasses[color].replace('bg-', 'text-')}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-2xl font-bold text-gray-900">{value}</dt>
              <dd className="mt-1 text-sm text-gray-500">{subtitle}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
