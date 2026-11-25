import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Title } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { Role } from '@/lib/api';
import { useSession } from '@/lib/session';

const HOME_COPY: Record<Role, string> = {
  customer: 'Your orders will show here.',
  agent: 'Your market orders will show here.',
  rider: '',
  shopkeeper: 'Your hub queue will show here.',
  admin: 'Admins use the web dashboard.',
};

// Sends each role to its own home. Roles without an app yet get a placeholder.
export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return null;
  if (user.role === 'rider') return <Redirect href="/rider" />;
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
