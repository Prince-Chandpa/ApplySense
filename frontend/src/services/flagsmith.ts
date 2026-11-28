import flagsmith from '@flagsmith/flagsmith';

export const EXPERIMENT_FLAG = 'smartapply_job_experience';
export const CONTROL_VARIANT = 'control';
export const TREATMENT_VARIANT = 'smart_insights';

const VISITOR_STORAGE_KEY = 'appliesense_visitor_id';

/**
 * Retrieves the stable visitor ID from localStorage, or creates one if it doesn't exist.
 */
export const getVisitorId = (): string => {
  let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);

  if (!visitorId) {
    visitorId = `visitor_${crypto.randomUUID()}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  }

  return visitorId;
};

/**
 * Resets visitor identity for demonstration / evaluation purposes.
 * Evaluators can use this to be re-allocated in the 50/50 experiment.
 */
export const resetVisitorId = async (): Promise<string> => {
  const newId = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(VISITOR_STORAGE_KEY, newId);
  try {
    await flagsmith.identify(newId);
  } catch (err) {
    console.warn('Could not re-identify flagsmith immediately:', err);
  }
  return newId;
};

/**
 * Initialize visitor identity with Flagsmith SDK.
 */
export const initializeExperimentIdentity = async (): Promise<void> => {
  const visitorId = getVisitorId();
  try {
    await flagsmith.identify(visitorId);
  } catch (err) {
    console.error('Failed to identify visitor with Flagsmith:', err);
  }
};

/**
 * Track an application started event to Flagsmith Managed Warehouse.
 * Safe error handling so UI doesn't crash if network or Flagsmith is blocked.
 */
export const trackApplicationStartedEvent = async (): Promise<boolean> => {
  try {
    flagsmith.trackEvent('application_started');
    await flagsmith.flushEvents();
    return true;
  } catch (error) {
    console.error('Error tracking application_started with Flagsmith:', error);
    return false;
  }
};

/**
 * Track an application completed event to Flagsmith Managed Warehouse.
 * Flushes events and handles any network errors gracefully.
 */
export const trackApplicationCompletedEvent = async (): Promise<boolean> => {
  try {
    flagsmith.trackEvent('application_completed');
    await flagsmith.flushEvents();
    return true;
  } catch (error) {
    console.error('Error tracking application_completed with Flagsmith:', error);
    return false;
  }
};

export default flagsmith;
