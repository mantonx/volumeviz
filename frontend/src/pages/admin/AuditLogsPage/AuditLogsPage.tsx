/**
 * AuditLogsPage - Admin page for viewing system audit logs
 *
 * Features:
 * - View real audit log entries from GET /api/v1/audit-logs
 * - Filter by action, status, and free-text search
 * - Pagination
 * - Export filtered logs as CSV via GET /api/v1/audit-logs/export
 */

import React, { useState } from 'react';
import { FileText, Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useGetApiV1AuditLogs,
  getApiV1AuditLogsExport,
} from '@/api/orval-generated/api';

const PAGE_SIZE = 25;

export const AuditLogsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const params = {
    search: debouncedSearch || undefined,
    action: filterAction || undefined,
    status: filterStatus || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError } = useGetApiV1AuditLogs(params, {
    query: { placeholderData: (prev: any) => prev },
  });

  const response = data?.status === 200 ? data.data : undefined;
  const logs = response?.logs ?? [];
  const total = response?.total ?? 0;

  const resetToFirstPage = () => setOffset(0);

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900';
      case 'failed':
      case 'failure':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900';
      default:
        return 'text-secondary bg-surface-secondary';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = (await getApiV1AuditLogsExport({
        search: debouncedSearch || undefined,
        action: filterAction || undefined,
        status: filterStatus || undefined,
      })) as unknown as Response;
      if (!(res instanceof Response) || !res.ok) {
        throw new Error('Failed to export audit logs');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Failed to export audit logs',
      );
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Audit Logs</h1>
          <p className="mt-2 text-secondary">
            View and search system audit logs
          </p>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting…' : 'Export Logs'}
        </Button>
      </div>

      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {exportError}
        </div>
      )}

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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetToFirstPage();
              }}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                resetToFirstPage();
              }}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
            >
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="create_user">Create User</option>
              <option value="volume.scan">Scan Volume</option>
              <option value="volume.delete">Delete Volume</option>
              <option value="delete_user">Delete User</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                resetToFirstPage();
              }}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
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
            <thead className="bg-surface-secondary border-b border-line">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-line">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                    {log.username || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                    <code className="bg-surface-secondary px-2 py-1 rounded">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                    {log.resource_type}
                    {log.resource_id && (
                      <span className="text-tertiary ml-1">
                        ({log.resource_id})
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
                  <td className="px-6 py-4 text-sm text-tertiary max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-tertiary">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex items-center gap-1"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              className="flex items-center gap-1"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty / error / loading states */}
      {isError && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">
            Couldn't load audit logs
          </h3>
          <p className="mt-1 text-sm text-tertiary">
            There was a problem reaching the server. Try again shortly.
          </p>
        </div>
      )}
      {!isError && !isLoading && logs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">
            No audit logs found
          </h3>
          <p className="mt-1 text-sm text-tertiary">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
