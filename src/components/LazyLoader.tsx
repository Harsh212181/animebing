// src/components/LazyLoader.tsx - YEH NAYI FILE BANAYEIN
import React from 'react';
import Spinner from './Spinner';

interface LazyLoaderProps {
  height?: string;
  text?: string;
}

const LazyLoader: React.FC<LazyLoaderProps> = ({ 
  height = 'h-64', 
  text = 'Loading...' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${height} bg-slate-800/30 rounded-lg`}>
      <Spinner className="w-8 h-8 mb-2" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
};

export default LazyLoader;