import Constants from 'expo-constants';

// Dev backend. A phone can't reach "localhost" on your computer, so take the
// host the Expo dev server is running on (the same machine as the backend) and
// use port 8000. EXPO_PUBLIC_API_URL overrides it (e.g. a deployed backend).
function resolveApiBase(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:8000`;
}

export const API_BASE = resolveApiBase();
