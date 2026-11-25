import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, SafeAreaView } from '@/components/ui';
import type { Role } from '@/lib/api';
import { useSession } from '@/lib/session';

const HOME_COPY: Record<Role, string> = {
  customer: 'Your orders will show here.',
  agent: '',
  rider: '',
  shopkeeper: '',
  admin: 'Admins use the web dashboard.',
};

// Sends each role to its own home. Roles without an app yet get a placeholder.
export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return null;
  if (user.role === 'agent') return <Redirect href="/agent" />;
  if (user.role === 'rider') return <Redirect href="/rider" />;
  if (user.role === 'shopkeeper') return <Redirect href="/shopkeeper" />;
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-center gap-2 p-6">
        <Text className="text-3xl font-extrabold text-ink">Hi{user.full_name ? `, ${user.full_name}` : ''}</Text>
        <Text className="text-base text-muted">Signed in as {user.role}.</Text>
        <Text className="text-base text-muted">{HOME_COPY[user.role]}</Text>
      </View>
      <View className="p-6">
        <Button label="Sign out" variant="neutral" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}
