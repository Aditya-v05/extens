import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/components/styles.css';
import Accounts from './Accounts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Accounts />
  </StrictMode>,
);
