// components/TermsAndConditions.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0c1c] text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6">
          &larr; Back to Home
        </Link>
        
        <div className="bg-slate-800/50 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Terms & Conditions</h1>
          
          <div className="prose prose-invert max-w-none">
            <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-4 mb-6">
              <h2 className="text-xl font-semibold text-purple-400">Welcome to Animabing</h2>
            </div>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-300 mb-4">
              By accessing and using Animabing, you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">2. Use License</h2>
            <p className="text-slate-300 mb-4">
              Permission is granted to temporarily access the materials on Animabing's website for personal, 
              non-commercial transitory viewing only.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">3. User Responsibilities</h2>
            <ul className="text-slate-300 list-disc list-inside space-y-2 mb-4">
              <li>You must be at least 13 years old to use this service</li>
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>You agree not to use the service for any illegal purpose</li>
              <li>You will not upload any malicious content</li>
            </ul>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">4. Content Policy</h2>
            <p className="text-slate-300 mb-4">
              Animabing acts as an index and directory for content available on the internet. We do not host, 
              store, or transmit any video files on our servers.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">5. Disclaimer</h2>
            <p className="text-slate-300 mb-4">
              The materials on Animabing's website are provided on an 'as is' basis. Animabing makes no warranties, 
              expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, 
              implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement 
              of intellectual property or other violation of rights.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">6. Limitations</h2>
            <p className="text-slate-300 mb-4">
              In no event shall Animabing or its suppliers be liable for any damages (including, without limitation, 
              damages for loss of data or profit, or due to business interruption) arising out of the use or inability 
              to use the materials on Animabing's website.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">7. Revisions and Errata</h2>
            <p className="text-slate-300 mb-4">
              The materials appearing on Animabing's website could include technical, typographical, or photographic errors. 
              Animabing does not warrant that any of the materials on its website are accurate, complete, or current.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">8. Links</h2>
            <p className="text-slate-300 mb-4">
              Animabing has not reviewed all of the sites linked to its website and is not responsible for the contents 
              of any such linked site. The inclusion of any link does not imply endorsement by Animabing of the site.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">9. Modifications</h2>
            <p className="text-slate-300 mb-4">
              Animabing may revise these terms of service for its website at any time without notice. By using this website 
              you are agreeing to be bound by the then current version of these terms of service.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">10. Governing Law</h2>
            <p className="text-slate-300">
              These terms and conditions are governed by and construed in accordance with the laws and you irrevocably 
              submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;