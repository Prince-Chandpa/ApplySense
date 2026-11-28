import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useExperiment } from '@flagsmith/flagsmith/react';
import {
  EXPERIMENT_FLAG,
  CONTROL_VARIANT,
  TREATMENT_VARIANT,
  getVisitorId,
} from './services/flagsmith';
import { fetchSharedApplications, recordSessionEvent } from './services/analyticsStorage';
import type { ApplicationRecord } from './types/job';
import { Navbar } from './components/Navbar';
import { JobListingPage } from './pages/JobListingPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import './App.css';

function App() {
  const experiment = useExperiment(EXPERIMENT_FLAG);

  const isTreatment = experiment?.variant === TREATMENT_VARIANT;

  useEffect(() => {
    const variant = experiment?.variant;
    if (
      experiment?.experiment?.inExperiment &&
      (variant === CONTROL_VARIANT || variant === TREATMENT_VARIANT)
    ) {
      void recordSessionEvent('experiment_exposed', variant, 'JOB-001');
    }
  }, [experiment?.variant, experiment?.experiment?.inExperiment]);

  const [applicationCount, setApplicationCount] = useState<number>(() => {
    try {
      const vId = getVisitorId();
      const raw = localStorage.getItem('appliesense_applications');
      const list: ApplicationRecord[] = raw ? JSON.parse(raw) : [];
      return list.filter(app => app.visitorId === vId).length;
    } catch {
      return 0;
    }
  });

  const fetchApplicationCount = useCallback(async () => {
    const vId = getVisitorId();
    try {
      const list = await fetchSharedApplications(vId);
      return list.length;
    } catch {
      try {
        const raw = localStorage.getItem('appliesense_applications');
        const list: ApplicationRecord[] = raw ? JSON.parse(raw) : [];
        return list.filter(app => app.visitorId === vId).length;
      } catch {
        return 0;
      }
    }
  }, []);

  const updateApplicationCount = useCallback(async () => {
    setApplicationCount(await fetchApplicationCount());
  }, [fetchApplicationCount]);

  useEffect(() => {
    let isMounted = true;
    fetchApplicationCount().then(count => {
      if (isMounted) setApplicationCount(count);
    });

    return () => {
      isMounted = false;
    };
  }, [fetchApplicationCount]);

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar isTreatment={isTreatment} applicationCount={applicationCount} />

        <Routes>
          <Route
            path="/"
            element={
              <JobListingPage
                isTreatment={isTreatment}
                onApplicationSuccess={updateApplicationCount}
              />
            }
          />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
