import '@/global.css';

import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import SplashOverlay from '@/components/SplashOverlay';
import { SessionProvider, useSession } from '@/lib/session';

// Signed-out people start on the intro slides, whatever order the screens are declared in.
export const unstable_settings = { anchor: 'intro' };

// Module scope: must run before the first render or the splash can hide early.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { user } = useSession();
  const [splashDone, setSplashDone] = useState(false);
  // Signed-out people land on the role picker (welcome), never straight on a login form.
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="intro" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
      </Stack>
      {!splashDone ? <SplashOverlay ready={fontsReady} onDone={() => setSplashDone(true)} /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsReady] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  // The native splash stays up until the fonts are ready; our animated one takes over.
  if (fontsReady) SplashScreen.hide();
  if (!fontsReady) return null;
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Navigator fontsReady={fontsReady} />
    </SessionProvider>
  );
}
