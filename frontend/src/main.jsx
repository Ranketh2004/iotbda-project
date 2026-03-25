// UI enhancements
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import CuteBackgroundDecor from './components/CuteBackgroundDecor.jsx';
import { applyThemeToDocument, readDarkModeFromStorage } from './theme';
import './index.css';

applyThemeToDocument(readDarkModeFromStorage());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CuteBackgroundDecor />
      <div className="app-content-layer">
        <App />
      </div>
    </BrowserRouter>
  </React.StrictMode>,
);
