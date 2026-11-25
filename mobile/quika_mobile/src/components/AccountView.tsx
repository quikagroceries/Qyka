import { Image, View } from 'react-native';
import { Text } from '@/components/Text';

import { Button, Card, SafeAreaView } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function AccountView({ fallbackName }: { fallbackName: string }) {
  const { user, signOut } = useSession();
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
        <Button label="Sign out" variant="neutral" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}
