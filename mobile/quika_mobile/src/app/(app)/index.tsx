import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/Text';

import AppLoading from '@/components/AppLoading';
import { Button, SafeAreaView } from '@/components/ui';
import type { Role } from '@/lib/types';
import { useSession } from '@/lib/session';

const HOME_COPY: Record<Role, string> = {
  customer: '',
  agent: '',
  rider: '',
  shopkeeper: '',
  admin: 'Admins use the web dashboard.',
};

// Sends each role to its own home. Roles without an app yet get a placeholder.
export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return <AppLoading />;
  const to = user.role === 'customer' ? '/customer/new-order' : user.role === 'agent' ? '/agent' : user.role === 'rider' ? '/rider' : user.role === 'shopkeeper' ? '/shopkeeper' : null;
  if (to)
    return (
      <>
        <AppLoading />
        <Redirect href={to} />
      </>
    );
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-center gap-2 p-6">
        <Text className="text-3xl font-extrabold text-ink">Hi{user.full_name ? `, ${user.full_name}` : ''}</Text>
        <Text className="text-base text-muted">Signed in as {user.role}.</Text>
        <Text className="text-base text-muted">{HOME_COPY[user.role]}</Text>
      </View>
      <View className="p-6">
        <Button label="Sign out" variant="neutral" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}
