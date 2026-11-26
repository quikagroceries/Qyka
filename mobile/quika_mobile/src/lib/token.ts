import * as SecureStore from 'expo-secure-store';

// The sign-in token lives in the phone's secure storage, so staying signed in survives closing the app.
const KEY = 'qyka.token';
let token: string | null = null;

export const getToken = () => token;

/** Reads the saved token (call once on start). */
export async function loadToken(): Promise<string | null> {
  try {
    token = await SecureStore.getItemAsync(KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function saveToken(t: string) {
  token = t;
  try {
    await SecureStore.setItemAsync(KEY, t);
  } catch {
    // Still signed in for this session; it just won't survive closing the app.
  }
}

export async function clearToken() {
  token = null;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing saved to clear.
  }
}

// Any 401 from any request signs the person out in one place (the session registers its handler here).
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
export const fireUnauthorized = () => onUnauthorized?.();
