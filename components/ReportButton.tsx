  // components/ReportButton.tsx - ENHANCED VERSION
import React, { useState } from 'react';
import axios from 'axios';
import { createPortal } from "react-dom";

const API_BASE = 'https://animabing-backend.animabingwatch.workers.dev/api';

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
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!issueType) return setMessage('Please select an issue type');
    if (!description || description.trim().length < 10)
      return setMessage('❌ Description must be at least 10 characters');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setMessage('❌ Invalid email');

    setIsSubmitting(true);
    setMessage('');

    try {
      const res = await axios.post(`${API_BASE}/reports`, {
        animeId,
        episodeId: episodeId || null,
        episodeNumber: episodeNumber || null,
        issueType,
        description: description.trim(),
        email: email || 'Not provided',
        username: username || 'Anonymous'
      });

      if (res.data.success) {
        setMessage('✅ Report submitted successfully!');
        setTimeout(() => {
          setShowModal(false);
          setMessage('');
          setIssueType('');
          setDescription('');
          setEmail('');
          setUsername('');
        }, 2500);
      }

    } catch (err: any) {
      setMessage('❌ Failed to submit report. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setTimeout(() => {
      setMessage('');
      setIssueType('');
      setDescription('');
      setEmail('');
      setUsername('');
    }, 300);
  };

  return (
    <>
      {/* Enhanced icon button */}
      <button
        onClick={handleButtonClick}
        className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-2 rounded-lg shadow-lg hover:shadow-red-500/20 transition-all duration-200 group relative"
        title="Report Issue"
      >
        <span className="text-sm transition-transform group-hover:scale-110">🚨</span>
        {/* Tooltip */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          Report Issue
        </div>
      </button>

      {/* ENHANCED MODAL WITH BETTER STYLING */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Animated Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
              onClick={handleClose}
            />

            {/* Enhanced Center Popup */}
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700/50 p-6 z-[10000] max-h-[85vh] overflow-y-auto animate-in fade-in-90 zoom-in-90 duration-300">
              
              {/* Enhanced Header */}
              <div className="flex justify-between items-start border-b border-slate-700/50 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Report Issue
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {animeTitle} {episodeNumber ? ` - Episode ${episodeNumber}` : ''}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700/50 transition-colors duration-200"
                >
                  ×
                </button>
              </div>

              {/* Enhanced Form */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Optional Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                      Email <span className="text-slate-500 text-xs">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 text-white rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-800/70 placeholder-slate-500"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                      Username <span className="text-slate-500 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 text-white rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-800/70 placeholder-slate-500"
                      placeholder="Anonymous"
                    />
                  </div>
                </div>

                {/* Issue Type */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                    Issue Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 text-white rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-800/70 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-800">Select Issue Type</option>
                    <option value="Link Not Working" className="bg-slate-800">Download Link Not Working</option>
                    <option value="Wrong Episode" className="bg-slate-800">Wrong Episode Content</option>
                    <option value="Poor Quality" className="bg-slate-800">Poor Video Quality</option>
                    <option value="Audio Issue" className="bg-slate-800">Audio Issue</option>
                    <option value="Subtitle Issue" className="bg-slate-800">Subtitle Issue</option>
                    <option value="Other" className="bg-slate-800">Other Issue</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 text-white rounded-xl px-3 py-2.5 text-sm transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-slate-800/70 placeholder-slate-500 resize-none h-24"
                    placeholder="Please describe the issue in detail..."
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-xs ${description.length >= 10 ? 'text-green-400' : 'text-slate-500'}`}>
                      {description.length >= 10 ? '✓' : '●'} {description.length}/10 characters
                    </span>
                    <span className="text-slate-500 text-xs">Minimum 10 characters</span>
                  </div>
                </div>

                {/* Message Display */}
                {message && (
                  <div
                    className={`p-3 rounded-xl border text-sm transition-all duration-300 ${
                      message.includes("✅")
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {message.includes("✅") ? "✅" : "❌"}
                      </span>
                      <span>{message.replace(/[✅❌]/g, '')}</span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-slate-700 disabled:to-slate-700 text-white py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/25 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting Report...
                    </>
                  ) : (
                    <>
                      <span>🚨</span>
                      Submit Report
                    </>
                  )}
                </button>

                {/* Help Text */}
                <p className="text-center text-slate-500 text-xs">
                  We'll review your report and fix the issue as soon as possible
                </p>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ReportButton;