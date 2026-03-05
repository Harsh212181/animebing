import React from 'react';
import { FaRupeeSign, FaUsers, FaFilm, FaCheckCircle, FaMoneyBillWave } from 'react-icons/fa';

const EarnMoneySimple: React.FC = () => {
  return (
    <>
      {/* Header */}
      <div className="text-center border-b border-purple-800 pb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold flex items-center justify-center gap-2 flex-wrap">
          Anime<span className="text-green-400">Bing</span>
          <span className="text-2xl bg-purple-800/50 px-3 py-1 rounded-full text-green-300">Earn</span>
        </h1>
        <p className="text-lg md:text-xl text-purple-300 mt-3 max-w-2xl mx-auto">
          Promote AnimeBing and earn real money by sending traffic
        </p>
      </div>

      {/* Earning Highlight Card */}
      <div className="bg-gradient-to-br from-purple-800/60 to-purple-900/60 border-2 border-green-500/30 rounded-2xl p-6 md:p-8 text-center glow-green-border">
        <div className="flex justify-center mb-4">
          <FaRupeeSign className="text-5xl text-green-400" />
        </div>
        <p className="text-3xl md:text-4xl font-bold text-green-400 flex items-center justify-center gap-2 flex-wrap">
          ₹67 – ₹100
        </p>
        <p className="text-xl md:text-2xl text-purple-200 mt-2">
          Per 1000 Website Visitors!
        </p>
        <p className="text-purple-300 mt-4 text-lg flex items-center justify-center gap-2">
          <FaUsers className="text-green-400" /> Start Earning by Sending Real Traffic!
        </p>
      </div>

      {/* What You Can Promote & Quick Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Promote Content */}
        <div className="bg-purple-900/40 backdrop-blur-sm border border-purple-700 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <FaFilm className="text-3xl" /> What You Can Promote
          </h2>
          <ul className="space-y-3 text-purple-200">
            {[
              'Hindi Sub & Hindi Dub Anime',
              'English Sub Anime',
              'Anime Movies & Manga Videos',
              'Fast Download Links',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <FaCheckCircle className="text-green-400 mt-1 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Earning Details */}
        <div className="bg-purple-900/40 backdrop-blur-sm border border-purple-700 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <FaMoneyBillWave className="text-3xl" /> Earning Details
          </h2>
          <div className="space-y-3">
            <p className="text-purple-200 text-lg flex items-center gap-2">
              <FaRupeeSign className="text-green-400" />
              <span className="font-semibold">₹67–₹100 per 1000 visitors</span>
            </p>
            <p className="text-purple-300 text-sm flex items-start gap-2">
              <FaCheckCircle className="text-green-400 mt-1 flex-shrink-0" />
              Your earnings depend on traffic quality
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default EarnMoneySimple;