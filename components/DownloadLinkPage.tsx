 import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from './Spinner';
import { DownloadPage } from '../src/types';

// Use dynamic API base for local development and production
const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://animabing.onrender.com/api';

const DownloadLinkPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<DownloadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/download-pages/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setPage(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-500 text-center p-8">{error}</div>;
  if (!page) return <div className="text-center p-8">Page not found</div>;

  return (
    <div className="download-page container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-purple-600 mb-2">
        Download {page.animeId.title}
      </h1>
      <p className="text-gray-300 mb-6">{page.title}</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {page.links.map((link, idx) => (
          <div key={idx} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-semibold">Episode {link.episode}</span>
              {link.quality && (
                <span className="bg-purple-600 text-xs px-2 py-1 rounded">{link.quality}</span>
              )}
            </div>
            {link.language && (
              <p className="text-sm text-gray-400 mb-3">Language: {link.language}</p>
            )}
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-center py-2 rounded font-medium"
            >
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DownloadLinkPage;