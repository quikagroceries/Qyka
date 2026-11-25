import { Tabs } from 'expo-router';
import { Image, type ImageSourcePropType } from 'react-native';

// Shared tab bar look for the role apps: the web's illustrations as tab icons
// (full colour when active, faded when not), DM Sans labels, cream and white.
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: '#D9702F',
  tabBarInactiveTintColor: '#9B9B9B',
  tabBarLabelStyle: { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#EEEEE8', height: 64, paddingTop: 6, paddingBottom: 8 },
};

function TabImage({ source, focused }: { source: ImageSourcePropType; focused: boolean }) {
  return <Image source={source} resizeMode="contain" style={{ width: 30, height: 30, opacity: focused ? 1 : 0.45 }} />;
}

export const tabIcon = (source: ImageSourcePropType) => {
  const render = ({ focused }: { focused: boolean }) => <TabImage source={source} focused={focused} />;
  return render;
};

export const ICONS = {
  order: require('../../assets/illustrations/shop.webp'),
  track: require('../../assets/illustrations/track.webp'),
  messages: require('../../assets/illustrations/phone-shopping-list.webp'),
  account: require('../../assets/illustrations/settings.webp'),
  tasks: require('../../assets/illustrations/shopping-cart.webp'),
  jobs: require('../../assets/illustrations/rider-bicycle.webp'),
  earnings: require('../../assets/illustrations/wallet.webp'),
  hub: require('../../assets/illustrations/map-pin-storefront.webp'),
} as const;

export { Tabs };
