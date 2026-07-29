 // src/components/admin/ReportsManager.tsx - UPDATED VERSION
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../Spinner';

interface Report {
  _id: string;
  animeId?: {
    _id: string;
    title: string;
    thumbnail: string;
  };
  episodeId?: string;
  episodeNumber?: number;
  issueType?: string;
  description?: string;
  name?: string;
  email: string;
  subject?: string;
  message: string;
  type: 'episode' | 'contact';
  username: string;
  status: 'Pending' | 'In Progress' | 'Fixed' | 'Invalid';
  createdAt: string;
  userIP: string;
  userAgent: string;
  resolvedAt?: string;
  resolvedBy?: {
    username: string;
  };
  adminResponse?: string;
  responseDate?: string;
  subAdminUsername?: string;   // 👈 add karo
}

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

interface ReportsManagerProps {
  token?: string;
}

const ReportsManager: React.FC<ReportsManagerProps> = ({ token: tokenProp }) => {
  // Token resolver: prop first, then fallback to localStorage (for main admin)
  const getToken = () => tokenProp || localStorage.getItem('adminToken') || '';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Fixed' | 'Invalid'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'episode' | 'contact'>('All');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; report: Report | null }>({ show: false, report: null });
  const [expandedReports, setExpandedReports] = useState<string[]>([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [adminResponses, setAdminResponses] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchReports();
  }, [statusFilter, typeFilter]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const { data } = await axios.get(`${API_BASE}/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const token = getToken();
      console.log('🗑️ Deleting report:', reportId);

      await axios.delete(`${API_BASE}/admin/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDeleteConfirm({ show: false, report: null });
      fetchReports();

      alert('✅ Report deleted successfully!');
    } catch (err: any) {
      console.error('❌ Delete report error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to delete report';
      alert(`❌ ${errorMessage}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReports.length === 0) {
      alert('Please select reports to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedReports.length} reports? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = getToken();
      await axios.post(`${API_BASE}/admin/reports/bulk-delete`,
        { reportIds: selectedReports },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBulkDeleteMode(false);
      setSelectedReports([]);
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete reports');
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map(report => report._id));
    }
  };

  const toggleReportExpansion = (reportId: string) => {
    setExpandedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleResponseChange = (reportId: string, response: string) => {
    setAdminResponses(prev => ({
      ...prev,
      [reportId]: response
    }));
  };

  const updateReportStatus = async (reportId: string, status: Report['status']) => {
    try {
      const token = getToken();
      const updateData: any = { status };
      const response = adminResponses[reportId];

      if (response && status === 'Fixed') {
        updateData.adminResponse = response;
        updateData.responseDate = new Date();
      }

      if (status === 'Fixed') {
        updateData.resolvedAt = new Date();
      }

      await axios.put(`${API_BASE}/admin/reports/${reportId}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Clear the response for this report
      setAdminResponses(prev => {
        const newResponses = { ...prev };
        delete newResponses[reportId];
        return newResponses;
      });

      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update report');
    }
  };

  const quickUpdateStatus = async (reportId: string, status: Report['status']) => {
    try {
      const token = getToken();
      await axios.put(`${API_BASE}/admin/reports/${reportId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-600 text-white';
      case 'In Progress': return 'bg-blue-600 text-white';
      case 'Fixed': return 'bg-green-600 text-white';
      case 'Invalid': return 'bg-red-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'episode': return 'bg-blue-500/20 text-blue-400';
      case 'contact': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType) {
      case 'Link Not Working': return 'bg-red-500/20 text-red-400';
      case 'Wrong Episode': return 'bg-orange-500/20 text-orange-400';
      case 'Poor Quality': return 'bg-yellow-500/20 text-yellow-400';
      case 'Audio Issue': return 'bg-purple-500/20 text-purple-400';
      case 'Subtitle Issue': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const filteredReports = reports.filter(report =>
    (statusFilter === 'All' || report.status === statusFilter) &&
    (typeFilter === 'All' || report.type === typeFilter)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-semibold text-white">
          User Reports ({filteredReports.length})
          <span className="text-sm text-slate-400 ml-2">
            {statusFilter !== 'All' && `- ${statusFilter}`}
            {typeFilter !== 'All' && ` - ${typeFilter}`}
          </span>
        </h3>

        <div className="flex items-center gap-4">
          {/* Type Filter */}
          <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg">
            {(['All', 'episode', 'contact'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  typeFilter === type
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {type === 'episode' ? 'Episode' : type === 'contact' ? 'Contact' : 'All'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg">
            {(['All', 'Pending', 'In Progress', 'Fixed', 'Invalid'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Bulk Delete Button */}
          {filteredReports.length > 0 && (
            <button
              onClick={() => setBulkDeleteMode(!bulkDeleteMode)}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                bulkDeleteMode
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-white'
              }`}
            >
              {bulkDeleteMode ? 'Cancel Bulk Delete' : 'Bulk Delete'}
            </button>
          )}

          <button
            onClick={fetchReports}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Delete Controls */}
      {bulkDeleteMode && filteredReports.length > 0 && (
        <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectAll}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                {selectedReports.length === filteredReports.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-white text-sm">
                Selected: {selectedReports.length} / {filteredReports.length}
              </span>
            </div>
            {selectedReports.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-700 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold transition"
              >
                🗑️ Delete Selected ({selectedReports.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.report && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500 p-6 rounded-lg shadow-2xl max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-bold text-red-400 mb-4">
              🗑️ Delete Report
            </h3>

            {deleteConfirm.report.type === 'contact' ? (
              <>
                <p className="text-slate-300 mb-2">
                  <strong>From:</strong> {deleteConfirm.report.name}
                </p>
                <p className="text-slate-300 mb-2">
                  <strong>Subject:</strong> {deleteConfirm.report.subject}
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-300 mb-2">
                  <strong>Anime:</strong> {deleteConfirm.report.animeId?.title}
                </p>
                {deleteConfirm.report.episodeNumber && (
                  <p className="text-slate-300 mb-2">
                    <strong>Episode:</strong> {deleteConfirm.report.episodeNumber}
                  </p>
                )}
                <p className="text-slate-300 mb-2">
                  <strong>Issue:</strong> {deleteConfirm.report.issueType}
                </p>
              </>
            )}

            <p className="text-red-300 text-sm mb-4">
              Are you sure you want to delete this report? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteReport(deleteConfirm.report!._id)}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex-1"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm({ show: false, report: null })}
                className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Reports Found</h3>
            <p className="text-slate-400">
              {statusFilter !== 'All' || typeFilter !== 'All'
                ? `No ${typeFilter !== 'All' ? typeFilter : ''} ${statusFilter !== 'All' ? statusFilter.toLowerCase() : ''} reports found.`
                : 'No user reports yet.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  {bulkDeleteMode && (
                    <th className="p-4 text-left text-slate-300 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedReports.length === filteredReports.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-purple-600 bg-slate-800 border-slate-600 rounded focus:ring-purple-500"
                      />
                    </th>
                  )}
                  <th className="p-4 text-left text-slate-300 font-medium">Type</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Details</th>
                  <th className="p-4 text-left text-slate-300 font-medium">User</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Date</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredReports.map(report => (
                  <React.Fragment key={report._id}>
                    <tr className="hover:bg-slate-700/30 transition-colors">
                      {bulkDeleteMode && (
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedReports.includes(report._id)}
                            onChange={() => toggleReportSelection(report._id)}
                            className="w-4 h-4 text-purple-600 bg-slate-800 border-slate-600 rounded focus:ring-purple-500"
                          />
                        </td>
                      )}

                      {/* Type */}
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getTypeColor(report.type)}`}>
                          {report.type === 'contact' ? 'Contact Form' : 'Episode Report'}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="p-4">
                        {report.type === 'episode' ? (
                          <div className="flex items-center gap-3">
                            {report.animeId?.thumbnail && (
                              <img
                                src={report.animeId.thumbnail}
                                alt={report.animeId.title}
                                className="w-12 h-16 object-cover rounded"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-white text-sm truncate max-w-[150px]">
                                {report.animeId?.title || 'Unknown Anime'}
                              </div>
                              {report.episodeNumber && (
                                <div className="text-xs text-slate-400">
                                  Episode {report.episodeNumber}
                                </div>
                              )}
                              {/* 👇 Added sub-admin username display */}
                              {report.subAdminUsername && (
                                <div className="text-xs text-purple-400">
                                   By: {report.subAdminUsername}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="text-white font-medium text-sm truncate max-w-[150px]" title={report.subject}>
                              {report.subject || 'No Subject'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {report.name || 'Anonymous'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* User */}
                      <td className="p-4">
                        <div className="text-sm">
                          <div className="text-white font-medium truncate max-w-[120px]" title={report.type === 'contact' ? report.name : report.username}>
                            {report.type === 'contact' ? report.name || 'Anonymous' : report.username}
                          </div>
                          <div className="text-blue-400 text-xs truncate max-w-[120px]" title={report.email}>
                            {report.email}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(report.status)}`}>
                          {report.status}
                        </span>
                        {report.adminResponse && (
                          <div className="text-green-400 text-xs mt-1">
                            ✅ Replied
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-slate-400 text-sm">
                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => toggleReportExpansion(report._id)}
                            className={`px-3 py-1 rounded text-ml transition-colors text-xs ${
                              expandedReports.includes(report._id)
                                ? 'bg-slate-500 text-white'
                                : 'bg-slate-600 hover:bg-slate-500 text-white'
                            }`}
                          >
                            {expandedReports.includes(report._id) ? '▲ Hide Details' : '▼ Show Details'}
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDeleteConfirm({ show: true, report })}
                              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-ml transition-colors text-xs flex-1"
                            >
                              Delete
                            </button>
                            {report.status === 'Pending' && (
                              <button
                                onClick={() => quickUpdateStatus(report._id, 'In Progress')}
                                className="bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded text-ml transition-colors text-xs"
                                title="Start Progress"
                              >
                                ▶
                              </button>
                            )}
                            {report.status === 'In Progress' && (
                              <button
                                onClick={() => quickUpdateStatus(report._id, 'Fixed')}
                                className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-lm transition-colors text-xs"
                                title="Mark Fixed"
                              >
                                ✓
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedReports.includes(report._id) && (
                      <tr className="bg-slate-900/50 transition-all duration-300">
                        <td colSpan={bulkDeleteMode ? 8 : 7} className="p-0">
                          <div className="p-6 border-t border-slate-700">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Column */}
                              <div className="space-y-4">
                                {report.type === 'episode' ? (
                                  <>
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        <span className="text-blue-400">🎬</span> Anime Information
                                      </h4>
                                      <div className="flex items-start gap-3">
                                        {report.animeId?.thumbnail && (
                                          <img
                                            src={report.animeId.thumbnail}
                                            alt={report.animeId.title}
                                            className="w-16 h-20 object-cover rounded"
                                          />
                                        )}
                                        <div>
                                          <p className="text-white font-medium">
                                            {report.animeId?.title || 'Unknown Anime'}
                                          </p>
                                          {report.episodeNumber && (
                                            <p className="text-slate-300 text-sm">
                                              Episode {report.episodeNumber}
                                            </p>
                                          )}
                                          {report.episodeId && (
                                            <p className="text-slate-400 text-xs mt-1">
                                              Episode ID: {report.episodeId}
                                            </p>
                                          )}
                                          {/* 👇 Added sub-admin info in expanded details */}
                                          {report.subAdminUsername && (
                                            <p className="text-slate-300 text-sm mt-1">
                                              Added by sub-admin: <span className="text-purple-400 font-medium">{report.subAdminUsername}</span>
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        <span className="text-orange-400">⚠️</span> Issue Details
                                      </h4>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-slate-400 text-sm">Issue Type</p>
                                          <span className={`px-2 py-1 rounded text-xs font-semibold mt-1 inline-block ${getIssueTypeColor(report.issueType || 'Other')}`}>
                                            {report.issueType || 'N/A'}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-slate-400 text-sm">Description</p>
                                          <p className="text-white text-sm mt-1 p-2 bg-slate-900/50 rounded whitespace-pre-wrap">
                                            {report.description || 'No description provided'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        <span className="text-purple-400">📧</span> Contact Information
                                      </h4>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-slate-400 text-sm">Name</p>
                                          <p className="text-white">{report.name || 'Not provided'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-400 text-sm">Email</p>
                                          <p className="text-blue-400">{report.email}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-400 text-sm">Subject</p>
                                          <p className="text-white">{report.subject || 'No subject'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Right Column */}
                              <div className="space-y-4">
                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                    <span className="text-green-400"></span> User Information
                                  </h4>
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-slate-400 text-sm">Username</p>
                                      <p className="text-white">{report.username}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 text-sm">Reported At</p>
                                      <p className="text-slate-300 text-sm">{formatDate(report.createdAt)}</p>
                                    </div>
                                    {report.resolvedAt && (
                                      <div>
                                        <p className="text-slate-400 text-sm">Resolved At</p>
                                        <p className="text-slate-300 text-sm">{formatDate(report.resolvedAt)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                    <span className="text-yellow-400">💬</span> Message
                                  </h4>
                                  <p className="text-slate-300 text-sm p-3 bg-slate-900/50 rounded-lg whitespace-pre-wrap">
                                    {report.type === 'episode'
                                      ? report.description || 'No description provided'
                                      : report.message || 'No message provided'
                                    }
                                  </p>
                                </div>

                                {report.adminResponse && (
                                  <div className="bg-green-600/10 border border-green-600/30 p-4 rounded-lg">
                                    <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                      <span className="text-green-400">✅</span> Admin Response
                                    </h4>
                                    <p className="text-green-300 text-sm whitespace-pre-wrap">
                                      {report.adminResponse}
                                    </p>
                                    {report.responseDate && (
                                      <p className="text-green-400/70 text-xs mt-2">
                                        Responded on: {formatDate(report.responseDate)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Admin Response Section */}
                            <div className="mt-6 pt-6 border-t border-slate-700">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                    <span className="text-blue-400">✍️</span> Admin Response
                                  </h4>
                                  <textarea
                                    value={adminResponses[report._id] || ''}
                                    onChange={(e) => handleResponseChange(report._id, e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 h-32"
                                    placeholder="Add your response here..."
                                  />
                                  <p className="text-slate-400 text-xs mt-2">
                                    Note: Response will be saved when you mark the report as "Fixed"
                                  </p>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-white font-semibold flex items-center gap-2">
                                    <span className="text-purple-400">⚡</span> Quick Actions
                                  </h4>
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => updateReportStatus(report._id, 'Fixed')}
                                      className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                      <span>✓</span> Mark as Fixed
                                    </button>
                                    <button
                                      onClick={() => updateReportStatus(report._id, 'In Progress')}
                                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                      <span>⏳</span> Mark In Progress
                                    </button>
                                    <button
                                      onClick={() => updateReportStatus(report._id, 'Invalid')}
                                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                      <span>✗</span> Mark Invalid
                                    </button>
                                    <button
                                      onClick={() => toggleReportExpansion(report._id)}
                                      className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-3 rounded transition-colors text-sm"
                                    >
                                      Close Details
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Technical Details */}
                              <div className="mt-6 bg-slate-800/50 p-4 rounded-lg">
                                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                                  <span className="text-red-400">🌐</span> Technical Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-slate-400 text-sm">User IP</p>
                                    <p className="text-slate-300 text-sm font-mono bg-slate-900/50 p-2 rounded">
                                      {report.userIP}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-sm">User Agent</p>
                                    <p className="text-slate-300 text-xs font-mono bg-slate-900/50 p-2 rounded truncate" title={report.userAgent}>
                                      {report.userAgent}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <div className="text-2xl font-bold text-white">{reports.length}</div>
          <div className="text-slate-400 text-sm">Total Reports</div>
        </div>
        <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-600/30">
          <div className="text-2xl font-bold text-blue-400">
            {reports.filter(r => r.type === 'episode').length}
          </div>
          <div className="text-blue-300 text-sm">Episode Reports</div>
        </div>
        <div className="bg-purple-600/20 p-4 rounded-lg border border-purple-600/30">
          <div className="text-2xl font-bold text-purple-400">
            {reports.filter(r => r.type === 'contact').length}
          </div>
          <div className="text-purple-300 text-sm">Contact Forms</div>
        </div>
        <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
          <div className="text-2xl font-bold text-yellow-400">
            {reports.filter(r => r.status === 'Pending').length}
          </div>
          <div className="text-yellow-300 text-sm">Pending</div>
        </div>
        <div className="bg-green-600/20 p-4 rounded-lg border border-green-600/30">
          <div className="text-2xl font-bold text-green-400">
            {reports.filter(r => r.status === 'Fixed').length}
          </div>
          <div className="text-green-300 text-sm">Fixed</div>
        </div>
        <div className="bg-red-600/20 p-4 rounded-lg border border-red-600/30">
          <div className="text-2xl font-bold text-red-400">
            {reports.filter(r => r.status === 'Invalid').length}
          </div>
          <div className="text-red-300 text-sm">Invalid</div>
        </div>
      </div>
    </div>
  );
};

export default ReportsManager;