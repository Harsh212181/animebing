// src/components/Portal.tsx - CREATE THIS NEW FILE
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

const Portal: React.FC<PortalProps> = ({ children }) => {
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Find or create modal root
    let root = document.getElementById('modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    setModalRoot(root);

    return () => {
      // Cleanup if needed
    };
  }, []);

  if (!modalRoot) return null;

  return ReactDOM.createPortal(children, modalRoot);
};

export default Portal;