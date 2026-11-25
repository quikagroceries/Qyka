import '@/global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/lib/session';

// Module scope: must run before the first render or the splash can hide early.
SplashScreen.preventAutoHideAsync();
// A short fade out, so the logo eases into the app instead of cutting.
SplashScreen.setOptions({ duration: 300, fade: true });

function Navigator() {
  const { user, isLoading } = useSession();
  if (!isLoading) SplashScreen.hide();
  if (isLoading) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Navigator />
    </SessionProvider>
  );
}
