// components/PrivacyPolicy.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0c1c] text-white py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6">
          &larr; Back to Home
        </Link>
        
        <div className="bg-slate-800/50 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-slate-300 mb-4">
              At Animabing, accessible from https://animabing.com, one of our main priorities is the privacy of our visitors. 
              This Privacy Policy document contains types of information that is collected and recorded by Animabing and how we use it.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Consent</h2>
            <p className="text-slate-300 mb-4">
              By using our website, you hereby consent to our Privacy Policy and agree to its terms.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Information we collect</h2>
            <p className="text-slate-300 mb-4">
              The personal information that you are asked to provide, and the reasons why you are asked to provide it, 
              will be made clear to you at the point we ask you to provide your personal information.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">How we use your information</h2>
            <ul className="text-slate-300 list-disc list-inside space-y-2 mb-4">
              <li>Provide, operate, and maintain our website</li>
              <li>Improve, personalize, and expand our website</li>
              <li>Understand and analyze how you use our website</li>
              <li>Develop new products, services, features, and functionality</li>
              <li>Communicate with you, either directly or through one of our partners</li>
              <li>Send you emails</li>
              <li>Find and prevent fraud</li>
            </ul>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Log Files</h2>
            <p className="text-slate-300 mb-4">
              Animabing follows a standard procedure of using log files. These files log visitors when they visit websites. 
              All hosting companies do this and a part of hosting services' analytics.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Cookies and Web Beacons</h2>
            <p className="text-slate-300 mb-4">
              Like any other website, Animabing uses 'cookies'. These cookies are used to store information including 
              visitors' preferences, and the pages on the website that the visitor accessed or visited.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">CCPA Privacy Rights</h2>
            <p className="text-slate-300 mb-4">
              Under the CCPA, among other rights, California consumers have the right to request that a business that 
              collects a consumer's personal data disclose the categories and specific pieces of personal data that 
              a business has collected about consumers.
            </p>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">GDPR Data Protection Rights</h2>
            <p className="text-slate-300 mb-4">
              We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:
            </p>
            <ul className="text-slate-300 list-disc list-inside space-y-2 mb-4">
              <li>The right to access</li>
              <li>The right to rectification</li>
              <li>The right to erasure</li>
              <li>The right to restrict processing</li>
              <li>The right to object to processing</li>
              <li>The right to data portability</li>
            </ul>

            <h2 className="text-xl font-semibold text-white mt-6 mb-4">Children's Information</h2>
            <p className="text-slate-300 mb-4">
              Another part of our priority is adding protection for children while using the internet. We encourage parents 
              and guardians to observe, participate in, and/or monitor and guide their online activity.
            </p>
            <p className="text-slate-300">
              Animabing does not knowingly collect any Personal Identifiable Information from children under the age of 13. 
              If you think that your child provided this kind of information on our website, we strongly encourage you to 
              contact us immediately and we will do our best efforts to promptly remove such information from our records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;