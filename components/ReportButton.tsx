 // components/ReportButton.tsx - API BASE URL CORRECT KARO
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ✅ CORRECT API BASE URL
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

interface ReportButtonProps {
  animeId: string;
  episodeId?: string;
  episodeNumber?: number;
  animeTitle: string;
}

const ReportButton: React.FC<ReportButtonProps> = ({ 
  animeId, 
  episodeId, 
  episodeNumber, 
  animeTitle 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🚨 Report button clicked - opening modal');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!issueType) {
      setMessage('Please select an issue type');
      return;
    }

    // Client-side validation
    if (!description || description.trim().length < 10) {
      setMessage('❌ Please provide detailed description (at least 10 characters)');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('❌ Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      console.log('📤 SUBMITTING TO:', `${API_BASE}/reports`);
      
      const response = await axios.post(`${API_BASE}/reports`, {
        animeId,
        episodeId: episodeId || null,
        episodeNumber: episodeNumber || null,
        issueType,
        description: description.trim(),
        email: email || 'Not provided',
        username: username || 'Anonymous'
      });

      console.log('✅ REPORT RESPONSE:', response.data);

      if (response.data.success) {
        setMessage('✅ Report submitted successfully! We will contact you soon.');
        setTimeout(() => {
          setShowModal(false);
          setMessage('');
          setIssueType('');
          setDescription('');
          setEmail('');
          setUsername('');
        }, 3000);
      }
    } catch (error: any) {
      console.error('❌ REPORT ERROR:', error);
      
      if (error.response?.data?.error) {
        setMessage(`❌ ${error.response.data.error}`);
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        setMessage('❌ Network error: Cannot connect to server. Please check if server is running.');
      } else {
        setMessage('❌ Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... rest of the code same as before
  return (
    <>
      <button
        onClick={handleButtonClick}
        className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded transition-colors flex items-center justify-center"
        title="Report Issue"
        type="button"
      >
        <span className="text-xs">🚨</span>
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-fade-in backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl max-w-md w-full mx-4 transform animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Report Issue</h3>
            <p className="text-slate-300 mb-4 text-sm">
              {animeTitle} {episodeNumber ? `- Episode ${episodeNumber}` : ''}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Contact Information Section */}
              <div className="bg-blue-600/20 p-4 rounded-lg border border-blue-500/30">
                <h4 className="text-blue-400 text-sm font-semibold mb-2">Contact Information (Optional)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                      placeholder="your@email.com"
                    />
                    <p className="text-slate-400 text-xs mt-1">
                      We'll contact you when issue is fixed
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                      placeholder="Your username (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Issue Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Issue Type *
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  required
                >
                  <option value="">Select Issue Type</option>
                  <option value="Link Not Working">Download Link Not Working</option>
                  <option value="Wrong Episode">Wrong Episode Content</option>
                  <option value="Poor Quality">Poor Video Quality</option>
                  <option value="Audio Issue">Audio Problem</option>
                  <option value="Subtitle Issue">Subtitle Problem</option>
                  <option value="Other">Other Issue</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Issue Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors h-24"
                  placeholder="Please describe the issue in detail (minimum 10 characters)..."
                  required
                />
                <p className="text-slate-400 text-xs mt-1">
                  {description.length}/10 characters (minimum 10 required)
                </p>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.includes('✅') 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {message}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Help Text */}
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                <p className="text-slate-400 text-xs text-center">
                  💡 We typically resolve issues within 24 hours
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;