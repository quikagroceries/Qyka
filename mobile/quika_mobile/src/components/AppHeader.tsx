import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GuestSheet from '@/components/GuestSheet';
import Logo from '@/components/Logo';
import { Text } from '@/components/Text';
import { Avatar } from '@/components/ui';
import { useNotifications, useNotificationSync } from '@/lib/notifications';
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
  const router = useRouter();
  useNotificationSync(!!user && !guest);
  const { unread } = useNotifications();
  if (route.name.includes('[') || route.name === 'apply') return null;
  return (
    <>
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between bg-canvas px-4 pb-2">
        <Logo height={30} />
        <View className="flex-row items-center gap-3">
        {guest ? null : (
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} new` : 'Notifications'} className="h-9 w-9 items-center justify-center rounded-full border border-line bg-surface active:bg-sunken">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </Svg>
            {unread > 0 ? (
              <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full bg-brand-orange px-1">
                <Text className="text-[10px] font-extrabold text-[#1A1A1A]">{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
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
