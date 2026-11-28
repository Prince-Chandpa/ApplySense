
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import flagsmith from '@flagsmith/flagsmith';
import { FlagsmithProvider } from '@flagsmith/flagsmith/react';
import './index.css';
import App from './App.tsx';

const storageKey = 'appliesense_visitor_id';

let visitorId = localStorage.getItem(storageKey);

if (!visitorId) {
  visitorId = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(storageKey, visitorId);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FlagsmithProvider
      flagsmith={flagsmith}
      options={{
        environmentID: import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_KEY,
        identity: visitorId,
        enableEvents: true,
      }}
    >
      <App />
    </FlagsmithProvider>
  </StrictMode>,
);
