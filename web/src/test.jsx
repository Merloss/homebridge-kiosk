import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createDemoState } from '../../server/demo.js';
import { App } from './App.jsx';
import { DevBar } from './components/DevBar.jsx';
import { startConnection } from './lib/connection.js';
import './styles.css';
import './test.css';

window.__KIOSK_DEMO_STATE__ = await createDemoState({ title: 'Component test' });
startConnection();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App devTools={(props) => <DevBar {...props} />} />
  </StrictMode>
);
