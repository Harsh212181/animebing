  // components/Contact.tsx - MOBILE FRIENDLY VERSION
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Spinner from './Spinner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      console.log('📨 Sending contact form data:', formData);
      
      const response = await axios.post(`${API_BASE}/contact`, formData);
      
      if (response.data.success) {
        setSubmitMessage(response.data.message);
        setMessageType('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        
        setTimeout(() => {
          setSubmitMessage('');
        }, 5000);
      }
    } catch (error: any) {
      console.error('❌ Contact form submission error:', error);
      
      const errorMessage = error.response?.data?.error || 
        'Network error: Please check your connection and try again.';
      
      setSubmitMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-4 sm:mb-6 transition-colors text-sm sm:text-base">
          &larr; Back to Home
        </Link>
        
        <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 md:p-8 backdrop-blur-sm border border-purple-500/20">
          <div className="text-left mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 border-l-4 border-purple-500 pl-3 sm:pl-4">
              Contact Us
            </h1>
            <p className="text-slate-400 mt-2 text-sm sm:text-base">Get in touch with the Animebing team</p>
          </div>

          {/* Success/Error Message */}
          {submitMessage && (
            <div className={`p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 border ${
              messageType === 'success' 
                ? 'bg-green-600/20 border-green-500 text-green-400'
                : 'bg-red-600/20 border-red-500 text-red-400'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3">
                {messageType === 'success' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm sm:text-base">{submitMessage}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Contact Information */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Get In Touch</h2>
                
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm sm:text-base">Email</h3>
                      <p className="text-slate-300 text-xs sm:text-sm break-all">animebingofficial@gmail.com</p>
                      <p className="text-slate-500 text-xs mt-1">Direct contact</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm sm:text-base">Support</h3>
                      <p className="text-slate-300 text-xs sm:text-sm">We're here to help with any questions</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm sm:text-base">Response Time</h3>
                      <p className="text-slate-300 text-xs sm:text-sm">Typically within 24-48 hours</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Before Contacting Us</h3>
                <ul className="text-slate-300 space-y-1 sm:space-y-2 text-xs sm:text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5 sm:mt-1 flex-shrink-0">•</span>
                    <span>Check our FAQ section</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5 sm:mt-1 flex-shrink-0">•</span>
                    <span>Ensure you've read our Terms & Conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5 sm:mt-1 flex-shrink-0">•</span>
                    <span>For DMCA requests, use the dedicated process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5 sm:mt-1 flex-shrink-0">•</span>
                    <span>Provide detailed information for faster resolution</span>
                  </li>
                </ul>
              </div>

              {/* Direct Email Option */}
              <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 border border-purple-500/30">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Prefer Direct Email?</h3>
                <p className="text-slate-300 text-xs sm:text-sm mb-3">
                  You can also email us directly at:
                </p>
                <a 
                  href="mailto:animebingofficial@gmail.com"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm w-full justify-center"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Direct Email
                </a>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:opacity-50"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:opacity-50"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
                    Subject *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">Select a subject</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Content Issue">Content Issue</option>
                    <option value="Partnership">Partnership</option>
                    <option value="DMCA Request">DMCA Request</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs sm:text-sm font-medium text-slate-300 mb-1 sm:mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    rows={4}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:opacity-50"
                    placeholder="Please describe your inquiry in detail. The more information you provide, the better we can help you."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" />
                      Sending Message...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
