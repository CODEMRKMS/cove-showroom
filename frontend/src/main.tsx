import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1 className="font-display p-8 text-3xl">Cove</h1>
  </StrictMode>,
);
