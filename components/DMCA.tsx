// components/DMCA.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const DMCA: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0c1c] text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6">
          &larr; Back to Home
        </Link>
        
        <div className="bg-slate-800/50 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-6">DMCA & Disclaimer</h1>
          
          <div className="prose prose-invert max-w-none">
            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <h2 className="text-xl font-semibold text-yellow-400 mb-2">Disclaimer/Terms of Conditions</h2>
              <p className="text-yellow-300">
                We Index the content that is already available on other websites. animabing.com does not host or store any files on its server. 
                All contents are provided by non-affiliated third parties.
              </p>
            </div>

            <p className="text-slate-300 mb-4">
              animabing.com does not accept responsibility for content hosted on third-party websites and does not have any involvement in the same.
              They are only indexed much like how GOOGLE works.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Content Policy</h2>
            <ul className="text-slate-300 list-disc list-inside space-y-2 mb-4">
              <li>We are not on any social media websites. All social media websites linked on the site are managed by fans.</li>
              <li>We do not store any copyright-protected content on our websites/servers.</li>
              <li>All the posts are indexed only for educational purposes and any linked content is stored only in third-party websites.</li>
              <li>This is a promotional website only, all the content indexed on this site is for testing/promotion purposes only.</li>
              <li>This site merely indexes of other sites contents.</li>
              <li>We highly ENCOURAGE users to BUY the CDs or DVDs of the content.</li>
            </ul>

            <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-4 my-6">
              <h2 className="text-xl font-semibold text-red-400 mb-2">Important Notice</h2>
              <p className="text-red-300">
                If you Do not agree to all the terms, please disconnect from this site now itself.
                By remaining at this site, you affirm your understanding and compliance of the above disclaimer.
              </p>
            </div>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">DMCA – Digital Millennium Copyright Act</h2>
            <p className="text-slate-300 mb-4">
              animabing.com is in compliance with 17 U.S.C. and the Digital Millennium Copyright Act ("DMCA"). 
              It is our policy to respond to any infringement notices and take appropriate actions under the 
              Digital Millennium Copyright Act ("DMCA") and other applicable intellectual property laws.
            </p>

            <h3 className="text-lg font-semibold text-white mt-4 mb-3">Copyright Infringement Claim Requirements</h3>
            <p className="text-slate-300 mb-4">
              If your copyrighted material has been posted on animabing.com and you want this material removed, 
              you must provide a written communication that details the information listed below:
            </p>
            <ol className="text-slate-300 list-decimal list-inside space-y-2 mb-4">
              <li>Provide evidence of the authorized person to act on behalf of the owner</li>
              <li>Provide sufficient contact information</li>
              <li>Identify the copyrighted work in sufficient detail</li>
              <li>A statement of good faith belief</li>
              <li>A statement that the information is accurate</li>
              <li>Must be signed by the authorized person</li>
            </ol>

            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mt-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">Contact Information</h3>
              <p className="text-blue-300">
                Send the written infringement notice to: <br/>
                <strong>Email:</strong> animebingofficial@gmail.com
              </p>
              <p className="text-blue-300 text-sm mt-2">
                Please allow 4-5 business days to remove content from our index.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DMCA;