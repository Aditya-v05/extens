import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/components/styles.css';
import Landing from './Landing';
import './landing.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
