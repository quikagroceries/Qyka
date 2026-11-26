import '@/global.css';

import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import AppLoading from '@/components/AppLoading';
import SplashOverlay from '@/components/SplashOverlay';
import { LanguageProvider } from '@/lib/language';
import { SplashProvider, useSplash } from '@/lib/splash';
import { SessionProvider, useSession } from '@/lib/session';

// Signed-out people start on the intro slides, whatever order the screens are declared in.
export const unstable_settings = { anchor: 'intro' };

// Module scope: must run before the first render or the splash can hide early.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });

function Navigator({ fontsReady }: { fontsReady: boolean }) {
  const { user, ready } = useSession();
  const { done: splashDone, finish } = useSplash();
  // Until the saved sign-in has been checked, we don't know which screens to show.
  if (!ready) return <AppLoading />;
  // Signed-out people land on the role picker (welcome), never straight on a login form.
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: '#F0ECE0' } }}>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="intro" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
          </Stack.Protected>
      </Stack>
      {!splashDone ? <SplashOverlay ready={fontsReady} onDone={finish} /> : null}
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
    <LanguageProvider>
      <SessionProvider>
        <SplashProvider>
          <StatusBar style="dark" />
          <Navigator fontsReady={fontsReady} />
        </SplashProvider>
      </SessionProvider>
    </LanguageProvider>
  );
}
