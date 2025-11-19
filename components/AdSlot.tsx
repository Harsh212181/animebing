 // components/AdSlot.tsx - SIMPLE WORKING VERSION
import React from 'react';

interface AdSlotProps {
  position: string;
  className?: string;
}

const AdSlot: React.FC<AdSlotProps> = ({ position, className = '' }) => {
  // Simple placeholder for now - no external images
  return (
    <div className={`ad-slot ${className}`}>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
        <div className="text-slate-400 text-sm mb-1">📢 Advertisement</div>
        <div className="text-slate-500 text-xs">{position} Slot</div>
      </div>
    </div>
  );
};

export default AdSlot;
