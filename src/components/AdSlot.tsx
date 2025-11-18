 // components/AdSlot.tsx - DYNAMIC VERSION
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface AdSlotProps {
  position: string;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const AdSlot: React.FC<AdSlotProps> = ({ position, className = '' }) => {
  const [adContent, setAdContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdContent();
  }, [position]);

  const fetchAdContent = async () => {
    try {
      setLoading(true);
      
      // Backend se ad data fetch karein
      const response = await axios.get(`${API_BASE}/ads`);
      const adSlots = response.data;
      
      // Current position ka ad slot find karein
      const currentAdSlot = adSlots.find((slot: any) => slot.position === position);
      
      if (currentAdSlot && currentAdSlot.isActive && currentAdSlot.adCode) {
        // Real ad code render karein
        setAdContent(
          <div 
            className="ad-content"
            dangerouslySetInnerHTML={{ __html: currentAdSlot.adCode }}
          />
        );
      } else {
        // Fallback ad
        setAdContent(
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
            <p className="text-slate-400 text-sm">📢 Advertisement - {position}</p>
            <p className="text-slate-500 text-xs">Ad slot is empty or inactive</p>
          </div>
        );
      }
    } catch (error) {
      console.error('Error loading ad:', error);
      setAdContent(
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
          <p className="text-slate-400 text-sm">📢 Advertisement - {position}</p>
        </div>
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`ad-slot ${className} animate-pulse`}>
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Loading ad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-slot ${className}`}>
      {adContent}
    </div>
  );
};

export default AdSlot;