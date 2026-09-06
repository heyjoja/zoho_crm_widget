import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ZohoProvider } from './context/ZohoContext.jsx';

// window.__zohoReady is already initialized in index.html
// No need to block rendering on the SDK
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ZohoProvider>
            <App />
        </ZohoProvider>
    </React.StrictMode>
);