import { Image, View } from 'react-native';
import { Text } from '@/components/Text';

import { useRouter } from 'expo-router';
import { Button, Card, SafeAreaView } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function AccountView({ fallbackName }: { fallbackName: string }) {
  const { user, signOut } = useSession();
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="gap-4 p-4">
        <Text className="text-2xl font-extrabold text-ink">Account</Text>
        <View className="items-center">
          <Image source={require('../../assets/illustrations/settings.webp')} resizeMode="contain" className="h-28 w-36" />
        </View>
        <Card>
          <Text className="text-base font-bold text-ink">{user?.full_name || fallbackName}</Text>
          <Text className="text-sm text-muted">{user?.phone || user?.email}</Text>
        </Card>
        {user?.role === 'customer' ? (
          <Card>
            <Text className="text-base font-extrabold text-ink">Earn with Qyka</Text>
            <Text className="text-sm text-muted">Shop the market for customers, or deliver their orders. Your details are filled in for you.</Text>
            <View className="mt-1 gap-2">
              <Button label="Apply as an agent" onPress={() => router.push({ pathname: '/customer/apply', params: { role: 'agent' } })} />
              <Button label="Apply as a rider" variant="neutral" onPress={() => router.push({ pathname: '/customer/apply', params: { role: 'rider' } })} />
            </View>
          </Card>
        ) : null}
        <Button label="Sign out" variant="neutral" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}
