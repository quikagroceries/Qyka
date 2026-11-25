import * as WebBrowser from 'expo-web-browser';

/**
 * Opens Paystack's hosted page and resolves when the customer closes it. We
 * don't rely on a redirect back into the app: the caller verifies with the
 * reference it already holds, which the backend reconciles either way.
 */
export async function openCheckout(url: string | null): Promise<void> {
  if (!url) throw new Error('Payment page is unavailable right now.');
  await WebBrowser.openBrowserAsync(url);
}
