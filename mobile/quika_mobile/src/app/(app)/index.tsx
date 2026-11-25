import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Title } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { Role } from '@/lib/api';
import { useSession } from '@/lib/session';

const HOME_COPY: Record<Role, string> = {
  customer: 'Your orders will show here.',
  agent: 'Your market orders will show here.',
  rider: 'The delivery job pool will show here.',
  shopkeeper: 'Your hub queue will show here.',
  admin: 'Admins use the web dashboard.',
};

// Placeholder landing. Each role gets its own home as its slice is built.
export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Title>Hi{user.full_name ? `, ${user.full_name}` : ''}</Title>
        <Body>Signed in as {user.role}.</Body>
        <Body>{HOME_COPY[user.role]}</Body>
      </View>
      <View style={{ padding: Spacing.four }}>
        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  body: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.two },
});
