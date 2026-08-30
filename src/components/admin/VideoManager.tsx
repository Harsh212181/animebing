import React, { useState } from 'react';
import VideoUploader from './VideoUploader';
import MediaLibrary from './MediaLibrary';

interface Props { token?: string; subAdminMode?: boolean; }

const VideoManager: React.FC<Props> = ({ token, subAdminMode = false }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <VideoUploader token={token} onUploadComplete={() => setRefreshTrigger(v => v + 1)} />
      <MediaLibrary token={token} refreshTrigger={refreshTrigger} subAdminMode={subAdminMode} />
    </div>
  );
};

export default VideoManager;