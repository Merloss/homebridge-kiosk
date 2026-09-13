import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { startConnection } from './lib/connection.js';
import { isDemo } from './lib/store.js';
import './styles.css';

startConnection();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isDemo()) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
