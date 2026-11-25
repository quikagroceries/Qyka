import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Avatar, EmptyState, Hero, SafeAreaView } from '@/components/ui';
import { whenLabel } from '@/lib/format';
import { CONVERSATIONS } from '@/lib/mock';

// The messages inbox: every order chat you're part of, newest first, with the
// person on the other end, the last message and an unread count.
export default function Inbox({ chatHref, agent }: { chatHref: (orderId: string) => string; agent: boolean }) {
  const router = useRouter();
  const list = CONVERSATIONS;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <Hero
          eyebrow="Messages"
          title={agent ? 'Your customers, one tap away' : "Talk to whoever's shopping for you"}
          body={agent ? "Every conversation on the orders you're shopping: photos, price questions, substitutions." : 'Every conversation with your agents in one place.'}
          image={require('../../../assets/illustrations/agent-customer-conversation.webp')}
        />
        {list.length === 0 ? (
          <EmptyState image={require('../../../assets/illustrations/phone-shopping-list.webp')} title="No conversations yet" subtitle="They start once an order has an agent." />
        ) : null}
        {list.length > 0 ? (
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
