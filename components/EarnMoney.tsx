 import React, { Suspense, lazy } from 'react';
import { FaInstagram, FaTelegram } from 'react-icons/fa';
import EarnMoneySimple from './EarnMoneySimple';
import Spinner from './Spinner';

// Lazy load the detailed plan
const PromotionPlanDetail = lazy(() => import('./PromotionPlanDetail'));

const EarnMoney: React.FC = () => {
  return (
    <div className="p-4 md:p-8 text-white space-y-8 max-w-6xl mx-auto">
      {/* Simple part – loads immediately */}
      <EarnMoneySimple />

      {/* Detailed part – lazy loaded with fallback spinner */}
      <Suspense fallback={
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" text="Loading promotion plan..." />
        </div>
      }>
        <PromotionPlanDetail />
      </Suspense>

      {/* ✅ JOIN PROMOTION PROGRAM BUTTON - NOW AT THE END */}
      <div className="flex justify-center pt-4">
        <a
          href="https://forms.gle/puPzBEdmuzhunheFA"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-2 px-4 sm:py-4 sm:px-8 rounded-full text-base sm:text-xl shadow-lg transform transition-all hover:scale-105 border-2 border-green-300/50 glow-green-border whitespace-nowrap"
          style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)' }}
        >
          🚀 Join Promotion Program
        </a>
      </div>

      {/* Contact Section with Real Logos */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-800 border border-green-500/30 rounded-2xl p-6 text-center space-y-6 glow-green-border">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Instagram */}
          <div>
            <p className="text-purple-300 mb-2 flex items-center justify-center gap-2">
              <FaInstagram className="text-pink-400 text-2xl" /> DM Us on Instagram
            </p>
            <a
              href="https://instagram.com/bingwatchanime"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 text-xl font-semibold hover:underline inline-flex items-center gap-2"
            >
              @bingwatchanime
            </a>
          </div>

          {/* Telegram */}
          <div>
            <p className="text-purple-300 mb-2 flex items-center justify-center gap-2">
              <FaTelegram className="text-blue-400 text-2xl" /> Join Our Telegram Channel
            </p>
            <a
              href="https://t.me/animebingchat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 text-xl font-semibold hover:underline inline-flex items-center gap-2"
            >
              t.me/animebingchat
            </a>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-gradient-to-r from-green-900/40 to-purple-900/40 border border-green-500/30 rounded-2xl p-6 text-center">
        <p className="text-2xl font-bold text-green-400 mb-3 flex items-center justify-center gap-2">
          <span role="img" aria-label="card">💳</span> Payment Method:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xl text-purple-200">
          <span className="flex items-center gap-1 bg-purple-800/40 px-4 py-2 rounded-full">
            <span>₹</span> UPI
          </span>
          <span className="flex items-center gap-1 bg-purple-800/40 px-4 py-2 rounded-full">
            <span>💰</span> Paytm
          </span>
          <span className="flex items-center gap-1 bg-purple-800/40 px-4 py-2 rounded-full">
            🏦 Bank Transfer
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-purple-400 text-sm border-t border-purple-800 pt-6">
        www.AnimeBing.in – Download Anime in Hindi & English
      </div>
    </div>
  );
};

export default EarnMoney;