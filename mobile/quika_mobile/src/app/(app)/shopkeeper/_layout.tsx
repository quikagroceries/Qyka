import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';

// The tabs live in (tabs); an order's page pushes on top of them, so tapping an order always opens it.
export default function ShopkeeperLayout() {
  const { user } = useSession();
  // Only shopkeepers belong here; anyone else goes back to their own home.
  if (user && user.role !== 'shopkeeper') return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0ECE0' } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
