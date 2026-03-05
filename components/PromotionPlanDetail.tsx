import React from 'react';
import {
  FaYoutube,
  FaInstagram,
  FaTelegram,
  FaFacebook,
  FaWhatsapp,
  FaGlobe,
  FaCheckCircle,
  FaUsers,
  FaCreditCard,
  FaRupeeSign,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { SiFreelancer, SiBlogger } from 'react-icons/si';

const PromotionPlanDetail: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="text-center border-b border-purple-800 pb-4">
        <h2 className="text-3xl md:text-4xl font-extrabold flex items-center justify-center gap-2 flex-wrap">
          <SiFreelancer className="text-green-400" /> Professional Promotion Plan
        </h2>
        <p className="text-purple-400 text-sm mt-1">(For You to Post Anywhere)</p>
      </div>

      {/* 1. What We Offer */}
      <section className="bg-purple-900/40 backdrop-blur-sm border border-purple-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
          <FaCheckCircle /> 1. What We Offer (Earning System)
        </h3>
        <ul className="space-y-3 text-purple-200">
          {[
            'Har 1000 Visitors = ₹67–₹100',
            'High‑quality traffic (YouTube, Website, SEO, Telegram, Insta) ka highest rate milega',
            'Payment Weekly ya Monthly (as per your rules)',
            'Live analytics proof provide kiya jayega (aap jab chaho)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <FaCheckCircle className="text-green-400 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Who Can Join */}
      <section className="bg-purple-900/40 backdrop-blur-sm border border-purple-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
          <FaUsers /> 2. Who Can Join?
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-purple-200">
          {[
            { icon: <FaYoutube className="text-red-500 text-xl" />, text: 'YouTubers (Anime / Entertainment / Meme makers)' },
            { icon: <SiBlogger className="text-blue-400 text-xl" />, text: 'Bloggers, Website Owners' },
            { icon: <FaInstagram className="text-pink-500 text-xl" />, text: 'Instagram Pages' },
            { icon: <FaFacebook className="text-blue-600 text-xl" />, text: 'Facebook Page Owners' },
            { icon: <FaWhatsapp className="text-green-500 text-xl" />, text: 'WhatsApp Group Admins' },
            { icon: <FaUsers className="text-purple-400 text-xl" />, text: 'Students who do affiliate marketing' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-purple-800/20 p-3 rounded-lg">
              <span className="mt-1">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. How to Promote */}
      <section className="bg-purple-900/40 backdrop-blur-sm border border-purple-700 rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
          <FaGlobe /> 3. How to Promote AnimeBing.in
        </h3>
        <p className="text-purple-300 mb-4 flex items-center gap-2">
          <FaTelegram className="text-blue-400" /> Aap traffic bhejne ke liye yeh methods use kar sakte ho:
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* YouTube */}
          <div className="bg-purple-800/30 p-4 rounded-xl border border-purple-700">
            <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-2">
              <FaYoutube className="text-red-500" /> YouTube
            </h4>
            <ul className="space-y-2 text-purple-200">
              {['Anime explanation videos', 'Anime review', 'Manga breakdown'].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-400 text-sm mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Instagram */}
          <div className="bg-purple-800/30 p-4 rounded-xl border border-purple-700">
            <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-2">
              <FaInstagram className="text-pink-500" /> Instagram
            </h4>
            <ul className="space-y-2 text-purple-200">
              {['Anime reels', 'Motivational anime clips', 'Story me website link'].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-400 text-sm mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Telegram */}
          <div className="bg-purple-800/30 p-4 rounded-xl border border-purple-700">
            <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-2">
              <FaTelegram className="text-blue-400" /> Telegram
            </h4>
            <ul className="space-y-2 text-purple-200">
              {['Anime downloading group', 'Channel forward traffic', 'Website links share'].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-400 text-sm mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Blogging / Website */}
          <div className="bg-purple-800/30 p-4 rounded-xl border border-purple-700">
            <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-2">
              <FaGlobe className="text-blue-300" /> Blogging / Website
            </h4>
            <ul className="space-y-2 text-purple-200">
              {['SEO article likh kar link add karna', 'Anime review / anime list', 'High retention traffic = higher payment'].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-400 text-sm mt-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PromotionPlanDetail;