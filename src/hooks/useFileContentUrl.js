import { useEffect, useState } from 'react';
import { getFileContentUrl } from '../utils/api';

export default function useFileContentUrl(file) {
  const [content, setContent] = useState({ key: '', url: '' });
  const fileId = file?.id;
  const storage = file?.storage;
  const fileUrl = file?.url;
  const fileKey = JSON.stringify([fileId, storage, fileUrl]);

  useEffect(() => {
    let active = true;
    if (!fileId) return () => { active = false; };

    getFileContentUrl({ id: fileId, storage, url: fileUrl })
      .then((url) => {
        if (active) setContent({ key: fileKey, url });
      })
      .catch((error) => {
        if (active) console.error('Unable to prepare private file access:', error);
      });

    return () => { active = false; };
  }, [fileId, storage, fileUrl, fileKey]);

  return content.key === fileKey ? content.url : '';
}
