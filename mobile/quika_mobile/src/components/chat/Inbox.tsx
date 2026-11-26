import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import SegmentedToggle from '@/components/SegmentedToggle';
import { Text } from '@/components/Text';
import { Avatar, Float, SafeAreaView, StatusBadge } from '@/components/ui';
import { shortId, whenLabel } from '@/lib/format';
import { useConversations } from '@/lib/inbox';

type Filter = 'all' | 'unread';

const LIST = ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'];
const BELL = ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'];

// The messages inbox: every order chat you're part of, newest first, with the
// person on the other end, the last message and an unread count.
export default function Inbox({ chatHref, agent }: { chatHref: (orderId: string) => string; agent: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const { items: all, loaded, error, reload } = useConversations();
  const unread = all.filter((c) => c.unread > 0);
  const shown = filter === 'all' ? all : unread;
  const unreadCount = unread.reduce((n, c) => n + c.unread, 0);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        {loaded && !error && all.length === 0 ? (
          <View className="items-center gap-2">
            <Animated.View entering={FadeInDown.duration(500)}>
              <Float>
                <Image source={require('../../../assets/illustrations/agent-customer-conversation.webp')} resizeMode="contain" style={{ width: 190, height: 140 }} />
              </Float>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
              <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
                {agent ? 'Your customers,' : 'Your agents,'}
                {'\n'}
                <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">one tap away</Text>
              </Text>
              <Text className="max-w-[300px] text-center text-base leading-6 text-muted">
                {agent ? 'Photos, price questions and substitutions for the orders you are shopping.' : 'Every conversation about your orders, in one place.'}
              </Text>
            </Animated.View>
          </View>
        ) : (
          <PageHeader
            top="Your"
            accent={agent ? 'customers' : 'agents'}
            subtitle={unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}` : "You're all caught up"}
            art={require('../../../assets/illustrations/agent-customer-conversation.webp')}
          />
        )}

        {!loaded ? <Text className="text-center text-sm text-muted">Loading your messages…</Text> : null}
        {error ? (
          <View className="items-center gap-2 rounded-3xl border border-line bg-surface p-4">
            <Text className="text-center text-sm font-semibold text-red-700">{error}</Text>
            <Pressable onPress={() => void reload()} hitSlop={8}>
              <Text className="text-sm font-bold text-brand-orange-dark">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <SegmentedToggle
          value={filter}
          onChange={setFilter}
          segments={[
            { id: 'all', label: 'All', icon: LIST, count: all.length },
            { id: 'unread', label: 'Unread', icon: BELL, count: unreadCount },
          ]}
        />

        {shown.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
            <Image source={require('../../../assets/illustrations/phone-shopping-list.webp')} resizeMode="contain" className="h-24 w-32" />
            <Text className="mt-1 text-base font-bold text-ink">{filter === 'unread' ? "You're all caught up" : 'No conversations yet'}</Text>
            <Text className="text-center text-sm text-muted">{filter === 'unread' ? 'New messages will show up here.' : 'They start once an order has an agent.'}</Text>
          </Animated.View>
        ) : null}

        {shown.map((c, i) => {
          const fresh = c.unread > 0;
          return (
            <Animated.View key={c.order_id} entering={FadeInDown.delay(i * 80).duration(450)}>
              <Pressable
                onPress={() => router.push(chatHref(c.order_id) as never)}
                className={'gap-3 rounded-3xl bg-surface p-4 shadow-sm active:bg-surface-2 ' + (fresh ? 'border-2 border-brand-orange/60' : 'border border-line')}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View className="flex-row items-center gap-4">
                  <View className="rounded-full bg-brand-orange/15 p-1">
                    <Avatar uri={c.other?.avatar_url} name={c.other?.full_name} className="h-14 w-14" />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-lg font-extrabold tracking-tight text-ink" numberOfLines={1}>
                        {c.other?.full_name || (agent ? 'Customer' : 'Agent')}
                      </Text>
                      <Text className={'text-xs ' + (fresh ? 'font-bold text-brand-orange-dark' : 'text-faint')}>{whenLabel(c.last_message.created_at)}</Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className={'flex-1 text-sm leading-5 ' + (fresh ? 'font-semibold text-ink' : 'text-muted')} numberOfLines={2}>
                        {c.last_message.text || (c.last_message.has_image ? 'Sent a photo' : '')}
                      </Text>
                      {fresh ? (
                        <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-orange px-1.5">
                          <Text className="text-xs font-extrabold text-ink">{c.unread > 9 ? '9+' : c.unread}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusBadge status={c.order_status} />
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {c.market_name ? `${c.market_name} · ` : ''}#{shortId(c.order_id)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
