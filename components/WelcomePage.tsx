import React from 'react';

const WelcomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">Welcome!</h1>
        <p className="text-gray-700">You have arrived via a special referral link. Enjoy your stay!</p>
        <p className="text-sm text-gray-500 mt-4">Start watching anime now.</p>
      </div>
    </div>
  );
};

export default WelcomePage;