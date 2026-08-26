const API_BASE = import.meta.env.VITE_API_BASE || 'https://animabing-backend.animabingwatch.workers.dev/api';

interface StartActivityParams {
  animeId: string;
  animeTitle?: string;
  contentType?: string;
  episodeNumber?: number;
  downloadPageId?: string;
  activityType: 'watch' | 'download';
  videoUrl?: string;
  quality?: string;
  language?: string;
}

export const startActivity = async (params: StartActivityParams): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE}/watch-activity/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.success ? data.activityId : null;
  } catch (err) {
    console.error('startActivity failed:', err);
    return null;
  }
};

export const sendHeartbeat = (activityId: string, watchDurationSec: number) => {
  fetch(`${API_BASE}/watch-activity/${activityId}/heartbeat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchDurationSec }),
  }).catch(() => {});
};

// ✅ keepalive:true — tab band hone par bhi request poori bhejne ki koshish karta hai
export const endActivity = (activityId: string, watchDurationSec: number) => {
  fetch(`${API_BASE}/watch-activity/${activityId}/end`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchDurationSec }),
    keepalive: true,
  }).catch(() => {});
};