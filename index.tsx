// index.tsx - YEH UPDATE KARNA HAI
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './src/components/ErrorBoundary'; // ← NAYA IMPORT ADD KARO

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>  {/* ← YEH ADD KARO */}
      <App />
    </ErrorBoundary> {/* ← YEH ADD KARO */}
  </React.StrictMode>
);