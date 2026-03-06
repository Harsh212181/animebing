 import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Saare existing query parameters le lo
    const params = new URLSearchParams(searchParams);
    
    // Home page par redirect karo, saare query parameters ke saath
    navigate({
      pathname: '/',
      search: params.toString()
    }, { replace: true }); // replace: true taaki history mein /welcome na rahe
  }, [navigate, searchParams]);

  // Redirect hone tak ek loading spinner ya message dikhao
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-purple-800">
      <div className="text-center text-white">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-lg">Redirecting to homepage...</p>
        <p className="text-sm text-purple-300 mt-2">Please wait</p>
      </div>
    </div>
  );
};

export default WelcomePage;