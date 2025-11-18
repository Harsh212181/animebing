 // src/components/admin/ReportsManager.tsx - WITH DELETE OPTION
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../Spinner';

interface Report {
  _id: string;
  animeId: {
    _id: string;
    title: string;
    thumbnail: string;
  };
  episodeId?: string;
  episodeNumber?: number;
  issueType: string;
  description?: string;
  email: string;
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
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

const ReportsManager: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Fixed' | 'Invalid'>('All');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; report: Report | null }>({ show: false, report: null });
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE}/admin/protected/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Delete single report
  const handleDeleteReport = async (reportId: string) => {
    try {
      console.log('🗑️ Deleting report:', reportId);
      
      await axios.delete(`${API_BASE}/admin/protected/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDeleteConfirm({ show: false, report: null });
      fetchReports(); // Refresh the list
      
      // Optional: Show success message
      alert('✅ Report deleted successfully!');
    } catch (err: any) {
      console.error('❌ Delete report error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to delete report';
      alert(`❌ ${errorMessage}`);
    }
  };

  // ✅ NEW: Bulk delete reports
  const handleBulkDelete = async () => {
    if (selectedReports.length === 0) {
      alert('Please select reports to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedReports.length} reports? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.post(`${API_BASE}/admin/protected/reports/bulk-delete`, 
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

  // ✅ NEW: Toggle report selection for bulk delete
  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  // ✅ NEW: Select all reports for bulk delete
  const toggleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map(report => report._id));
    }
  };

  const updateReportStatus = async (reportId: string, status: Report['status'], response?: string) => {
    try {
      const updateData: any = { status };
      
      if (response && status === 'Fixed') {
        updateData.adminResponse = response;
        updateData.responseDate = new Date();
      }
      
      if (status === 'Fixed') {
        updateData.resolvedAt = new Date();
      }

      await axios.put(`${API_BASE}/admin/protected/reports/${reportId}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedReport(null);
      setAdminResponse('');
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
    statusFilter === 'All' || report.status === statusFilter
  );

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>;
  if (error) return <p className="text-red-400 text-center p-4">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-semibold text-white">
          User Reports ({filteredReports.length})
          <span className="text-sm text-slate-400 ml-2">
            {statusFilter !== 'All' && `- ${statusFilter}`}
          </span>
        </h3>

        <div className="flex items-center gap-4">
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

          {/* ✅ NEW: Bulk Delete Button */}
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

      {/* ✅ NEW: Bulk Delete Controls */}
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

      {/* Response Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-4">
              Respond to Report
            </h3>
            <p className="text-slate-300 mb-2">
              <strong>User:</strong> {selectedReport.username} ({selectedReport.email})
            </p>
            <p className="text-slate-300 mb-4">
              <strong>Issue:</strong> {selectedReport.issueType}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Admin Response (Optional)
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 h-24"
                  placeholder="Add response or notes..."
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateReportStatus(selectedReport._id, 'Fixed', adminResponse)}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded transition-colors flex-1"
                >
                  Mark Fixed
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport._id, 'In Progress')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors"
                >
                  In Progress
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport._id, 'Invalid')}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition-colors"
                >
                  Mark Invalid
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.report && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500 p-6 rounded-lg shadow-2xl max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-bold text-red-400 mb-4">
              🗑️ Delete Report
            </h3>
            <p className="text-slate-300 mb-2">
              <strong>Anime:</strong> {deleteConfirm.report.animeId.title}
            </p>
            {deleteConfirm.report.episodeNumber && (
              <p className="text-slate-300 mb-2">
                <strong>Episode:</strong> {deleteConfirm.report.episodeNumber}
              </p>
            )}
            <p className="text-slate-300 mb-4">
              <strong>Issue:</strong> {deleteConfirm.report.issueType}
            </p>
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
              {statusFilter !== 'All'
                ? `No ${statusFilter.toLowerCase()} reports found.`
                : 'No user reports yet.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  {/* ✅ NEW: Checkbox for Bulk Delete */}
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
                  <th className="p-4 text-left text-slate-300 font-medium">Anime/Episode</th>
                  <th className="p-4 text-left text-slate-300 font-medium">User Contact</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Issue Type</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Description</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Date</th>
                  <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredReports.map(report => (
                  <tr key={report._id} className="hover:bg-slate-700/30 transition-colors">
                    {/* ✅ NEW: Checkbox for each report */}
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
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={report.animeId.thumbnail}
                          alt={report.animeId.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                        <div>
                          <div className="font-medium text-white text-sm">
                            {report.animeId.title}
                          </div>
                          {report.episodeNumber && (
                            <div className="text-xs text-slate-400">
                              Episode {report.episodeNumber}
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white font-medium">{report.username}</div>
                        <div className="text-blue-400 text-xs break-all">{report.email}</div>
                        {report.adminResponse && (
                          <div className="text-green-400 text-xs mt-1">
                            ✅ Replied
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getIssueTypeColor(report.issueType)}`}>
                        {report.issueType}
                      </span>
                    </td>

                    <td className="p-4 text-slate-300 text-sm max-w-xs">
                      {report.description || 'No description provided'}
                      {report.adminResponse && (
                        <div className="mt-2 p-2 bg-green-600/20 rounded border border-green-500/30">
                          <strong className="text-green-400 text-xs">Admin Response:</strong>
                          <p className="text-green-300 text-xs mt-1">{report.adminResponse}</p>
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </td>

                    <td className="p-4 text-slate-400 text-sm">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition-colors text-xs"
                        >
                          Respond
                        </button>
                        {/* ✅ NEW: Delete Button */}
                        <button
                          onClick={() => setDeleteConfirm({ show: true, report })}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors text-xs"
                        >
                          Delete
                        </button>
                        {report.status === 'Pending' && (
                          <button
                            onClick={() => updateReportStatus(report._id, 'In Progress')}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded text-sm transition-colors text-xs"
                          >
                            Start Progress
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
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <div className="text-2xl font-bold text-white">{reports.length}</div>
          <div className="text-slate-400 text-sm">Total Reports</div>
        </div>
        <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
          <div className="text-2xl font-bold text-yellow-400">
            {reports.filter(r => r.status === 'Pending').length}
          </div>
          <div className="text-yellow-300 text-sm">Pending</div>
        </div>
        <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-600/30">
          <div className="text-2xl font-bold text-blue-400">
            {reports.filter(r => r.status === 'In Progress').length}
          </div>
          <div className="text-blue-300 text-sm">In Progress</div>
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