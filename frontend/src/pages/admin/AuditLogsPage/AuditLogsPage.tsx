/**
 * AuditLogsPage - Admin page for viewing system audit logs
 *
 * Features:
 * - View all audit log entries
 * - Filter by user, action, resource
 * - Search by keywords
 * - Pagination
 * - Export logs
 */

import React, { useState } from 'react';
import { FileText, Search, Filter, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mock data - will be replaced with API calls
const mockAuditLogs = [
  {
    id: 1,
    timestamp: '2025-10-09T14:30:00Z',
    userId: 1,
    username: 'admin',
    action: 'login',
    resourceType: 'auth',
    resourceId: null,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    status: 'success',
    details: 'User logged in successfully',
  },
  {
    id: 2,
    timestamp: '2025-10-09T14:25:00Z',
    userId: 7,
    username: 'demouser',
    action: 'scan_volume',
    resourceType: 'volume',
    resourceId: 'volumeviz_movies_dev',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
    status: 'success',
    details: 'Volume scan initiated',
  },
  {
    id: 3,
    timestamp: '2025-10-09T14:20:00Z',
    userId: 1,
    username: 'admin',
    action: 'create_user',
    resourceType: 'user',
    resourceId: '8',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    status: 'success',
    details: 'Created new user: newuser',
  },
  {
    id: 4,
    timestamp: '2025-10-09T14:15:00Z',
    userId: 7,
    username: 'demouser',
    action: 'login',
    resourceType: 'auth',
    resourceId: null,
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
    status: 'failed',
    details: 'Invalid password',
  },
];

export const AuditLogsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [logs] = useState(mockAuditLogs);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = filterAction === '' || log.action === filterAction;
    const matchesStatus = filterStatus === '' || log.status === filterStatus;

    return matchesSearch && matchesAction && matchesStatus;
  });

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and search system audit logs
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="create_user">Create User</option>
              <option value="scan_volume">Scan Volume</option>
              <option value="delete_user">Delete User</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {log.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {log.resourceType}
                    {log.resourceId && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        ({log.resourceId})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Empty state */}
      {filteredLogs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No audit logs found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
