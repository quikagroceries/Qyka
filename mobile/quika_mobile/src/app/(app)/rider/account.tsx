import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Title } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function Account() {
  const { user, signOut } = useSession();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.body}>
        <Title>Account</Title>
        <Card>
          <Body style={{ fontWeight: '700', color: Colors.ink }}>{user?.full_name || 'Rider'}</Body>
          <Body>{user?.phone || user?.email}</Body>
        </Card>
        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  body: { padding: Spacing.four, gap: Spacing.three },
});
