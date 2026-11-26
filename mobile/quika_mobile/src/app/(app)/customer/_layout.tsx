import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';

// The tabs live in (tabs); order details, chats and the agent application push on top of them.
export default function CustomerLayout() {
  const { user } = useSession();
  if (user && user.role !== 'customer') return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0ECE0' } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
