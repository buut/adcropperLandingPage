import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import postMessageData from './assets/data.json'

// Expose data.json content globally as postMessageData and AD_DATA for testing
(window as any).postMessageData = postMessageData;
(window as any).AD_DATA = postMessageData;
console.log('✅ Dynamic Test Data available as: window.postMessageData and window.AD_DATA');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
