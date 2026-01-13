  // components/TermsAndConditions.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-4 sm:mb-6 transition-colors text-sm sm:text-base">
          &larr; Back to Home
        </Link>
        
        <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 md:p-8 backdrop-blur-sm border border-purple-500/20">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
              Terms & Conditions
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">Last Updated: November 2025</p>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Welcome Section */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                Welcome to <strong>Animebing</strong>, accessible at <strong className="break-words">https://animabing.in</strong>.
              </p>
              <p className="text-slate-300 mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed">
                By accessing or using our website, you agree to be bound by these Terms & Conditions.
              </p>
            </section>

            {/* 1. Acceptance of Terms */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-300 text-sm sm:text-base">
                If you do not agree with any part of the Terms, please discontinue the use of the website immediately.
              </p>
            </section>

            {/* 2. Use License */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">2. Use License</h2>
              <p className="text-slate-300 mb-3 sm:mb-4 text-sm sm:text-base">
                You are granted a limited, non-transferable, non-commercial license to access and view the content on Animebing for personal use only.
              </p>
              <p className="text-slate-300 font-semibold mb-2 text-sm sm:text-base">You agree not to:</p>
              <ul className="text-slate-300 list-disc list-inside space-y-2 ml-3 text-sm sm:text-base">
                <li>Copy, modify, or distribute content for commercial use</li>
                <li>Attempt to interfere with website functionality or security</li>
                <li>Use automated tools (bots/scrapers) without permission</li>
              </ul>
            </section>

            {/* 3. User Responsibilities */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">3. User Responsibilities</h2>
              <ul className="text-slate-300 list-disc list-inside space-y-2 ml-3 text-sm sm:text-base">
                <li>You must be 13 years or older to use our website.</li>
                <li>You are responsible for the security of your account and device.</li>
                <li>You agree not to upload or transmit malicious or harmful content.</li>
              </ul>
            </section>

            {/* 4. Content Disclaimer */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6 border-l-4 border-yellow-500">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">4. Content Disclaimer</h2>
              <p className="text-slate-300 mb-3 sm:mb-4 text-sm sm:text-base">
                Animebing does not host or upload any video files directly.
                All video content is provided by third-party services publicly available on the internet.
              </p>
              <p className="text-slate-300 text-sm sm:text-base">
                If any copyrighted material is found, rights holders may contact us for immediate removal.
              </p>
            </section>

            {/* 5. Google AdSense & Advertising */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6 border-l-4 border-green-500">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">5. Google AdSense & Advertising</h2>
              <p className="text-slate-300 mb-3 sm:mb-4 text-sm sm:text-base">
                This website uses Google AdSense for monetization.
                Google may collect anonymized data to provide tailored ads.
              </p>
              <div className="bg-slate-600/30 rounded-lg p-3 sm:p-4">
                <p className="text-slate-300 mb-2 text-sm sm:text-base">
                  Users can manage ad preferences here:
                </p>
                <a href="https://www.google.com/settings/ads" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-purple-400 hover:text-purple-300 transition-colors break-words text-sm sm:text-base">
                  https://www.google.com/settings/ads
                </a>
              </div>
            </section>

            {/* 6. Limitations of Liability */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">6. Limitations of Liability</h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Animebing shall not be held liable for any damages resulting from use or inability to access content, 
                including loss of data or business interruption.
              </p>
            </section>

            {/* 7. External Links */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">7. External Links</h2>
              <p className="text-slate-300 text-sm sm:text-base">
                We may include links to third-party websites.
                Animebing does not control or endorse external content and is not responsible for any third-party actions or policies.
              </p>
            </section>

            {/* 8. Copyright Violations / DMCA */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6 border-l-4 border-red-500">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">8. Copyright Violations / DMCA</h2>
              <p className="text-slate-300 mb-3 sm:mb-4 text-sm sm:text-base">
                If you believe any content infringes your copyright:
              </p>
              <div className="bg-slate-600/30 rounded-lg p-3 sm:p-4">
                <div className="text-slate-300 mb-2 text-sm sm:text-base">
                  <span className="text-red-400">📧</span>
                  <span className="ml-2">Email us at:</span>
                </div>
                <a href="mailto:animebingofficial@gmail.com" 
                   className="text-purple-400 hover:text-purple-300 transition-colors break-all text-sm sm:text-base block mt-1">
                  animebingofficial@gmail.com
                </a>
                <p className="text-slate-300 text-xs sm:text-sm mt-2">
                  Include proper proof and URLs — we will act promptly.
                </p>
              </div>
            </section>

            {/* 9. Modifications */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">9. Modifications</h2>
              <p className="text-slate-300 text-sm sm:text-base">
                We may update these Terms at any time.
                Continued use of the website means acceptance of updated terms.
              </p>
            </section>

            {/* 10. Governing Law */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">10. Governing Law</h2>
              <p className="text-slate-300 text-sm sm:text-base">
                These Terms are governed under the laws of India.
                Users agree to submit to the exclusive jurisdiction of Indian courts.
              </p>
            </section>

            {/* Contact Information */}
            <section className="bg-slate-700/30 rounded-lg p-4 sm:p-6 border-l-4 border-blue-500">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Contact Information</h2>
              <div className="bg-slate-600/30 rounded-lg p-3 sm:p-4">
                <p className="text-slate-300 text-sm sm:text-base">
                  For any questions regarding these Terms & Conditions, please contact us at:
                </p>
                <a href="mailto:animebingofficial@gmail.com" 
                   className="text-purple-400 hover:text-purple-300 transition-colors break-all text-sm sm:text-base block mt-2">
                  animebingofficial@gmail.com
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
