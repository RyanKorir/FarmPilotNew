import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/* Service worker disabled for development stability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
*/

console.log('Main.tsx executing...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('CRITICAL: Root element not found in DOM!');
} else {
  console.log('Root element found, mounting React app...');
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
