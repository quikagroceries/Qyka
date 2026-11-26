import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GuestSheet from '@/components/GuestSheet';
import Logo from '@/components/Logo';
import { Text } from '@/components/Text';
import { Avatar } from '@/components/ui';
import { useSession } from '@/lib/session';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer',
  agent: 'Agent',
  rider: 'Rider',
  shopkeeper: 'Shopkeeper',
};

type Props = {
  route: { name: string };
  navigation: { navigate: (name: string) => void };
};

/**
 * Top bar for the role apps' tab screens: the logo on the left, who you are on
 * the right (role chip + avatar, which opens Account). Detail screens (bracketed
 * routes) bring their own header, so this renders nothing for them.
 */
export default function AppHeader({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, guest, signOut } = useSession();
  const [guestOpen, setGuestOpen] = useState(false);
  if (route.name.includes('[') || route.name === 'apply') return null;
  return (
    <>
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between bg-canvas px-4 pb-2">
        <Logo height={30} />
        <Pressable
          onPress={() => (guest ? setGuestOpen(true) : navigation.navigate('account'))}
          accessibilityRole="button"
          accessibilityLabel={guest ? 'Guest: sign in' : 'Account'}
          className="flex-row items-center gap-2 active:opacity-70"
        >
          {user ? (
            <View className="rounded-full border border-line bg-surface px-2.5 py-1">
              <Text className="text-xs font-bold text-muted">{guest ? 'Guest' : (ROLE_LABEL[user.role] ?? user.role)}</Text>
            </View>
          ) : null}
          <Avatar uri={guest ? null : user?.avatar_url} name={guest ? 'Guest' : user?.full_name} className="h-9 w-9" />
        </Pressable>
      </View>
      <GuestSheet
        visible={guestOpen}
        onClose={() => setGuestOpen(false)}
        onSignIn={() => {
          setGuestOpen(false);
          signOut('sign-in');
        }}
      />
    </>
  );
}
