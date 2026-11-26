import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';

// The tabs live in (tabs); order details and chats push on top of them.
export default function AgentLayout() {
  const { user } = useSession();
  if (user && user.role !== 'agent') return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0ECE0' } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
