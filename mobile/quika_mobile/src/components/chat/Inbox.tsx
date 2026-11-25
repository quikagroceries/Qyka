import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Avatar, Card, ErrorBanner, Hero, SafeAreaView } from '@/components/ui';
import { api, type Conversation } from '@/lib/api';
import { errMsg, whenLabel } from '@/lib/format';
import { usePolling } from '@/lib/usePolling';

// The messages inbox: every order chat you're part of, newest first, with the
// person on the other end, the last message and an unread count.
export default function Inbox({ chatHref, agent }: { chatHref: (orderId: string) => string; agent: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.conversations());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  usePolling(load, 10_000);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Hero
          eyebrow="Messages"
          title={agent ? 'Your customers, one tap away' : "Talk to whoever's shopping for you"}
          body={agent ? "Every conversation on the orders you're shopping: photos, price questions, substitutions." : 'Every conversation with your agents in one place.'}
          image={require('../../../assets/illustrations/agent-customer-conversation.webp')}
        />
        <ErrorBanner message={error} />
        {list && list.length === 0 ? (
          <Card className="items-center">
            <Text className="text-base font-bold text-ink">No conversations yet</Text>
            <Text className="text-center text-sm text-muted">They start once an order has an agent.</Text>
          </Card>
        ) : null}
        {list && list.length > 0 ? (
          <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
            {list.map((c, i) => (
              <Pressable
                key={c.order_id}
                onPress={() => router.push(chatHref(c.order_id) as never)}
                className={'flex-row items-center gap-3 px-4 py-4 active:bg-sunken-2 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                <Avatar uri={c.other?.avatar_url} name={c.other?.full_name} className="h-12 w-12" />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
                      {c.other?.full_name || (agent ? 'Customer' : 'Agent')}
                    </Text>
                    <Text className="text-xs text-faint">{whenLabel(c.last_message.created_at)}</Text>
                  </View>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className={'flex-1 text-sm ' + (c.unread > 0 ? 'font-semibold text-ink' : 'text-muted')} numberOfLines={1}>
                      {c.last_message.text || (c.last_message.has_image ? '📷 Photo' : '')}
                    </Text>
                    {c.unread > 0 ? (
                      <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1">
                        <Text className="text-[11px] font-bold text-white">{c.unread > 9 ? '9+' : c.unread}</Text>
                      </View>
                    ) : null}
                  </View>
                  {c.market_name ? <Text className="text-xs text-faint">{c.market_name}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
