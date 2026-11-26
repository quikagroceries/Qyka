import { ActivityIndicator, View } from 'react-native';

import Logo from '@/components/Logo';

/** A cream screen with the logo, for the moments between screens, so the app never flashes blank. */
export default function AppLoading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: '#F0ECE0' }}>
      <Logo height={56} />
      <ActivityIndicator color="#EE9A5A" />
    </View>
  );
}
