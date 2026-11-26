import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { SafeAreaView } from '@/components/ui';
import { api, type AppNotification, type NotificationPrefs } from '@/lib/api';
import { clockTime, dayLabel } from '@/lib/format';
import { notificationStore, useNotifications } from '@/lib/notifications';
import { useSession } from '@/lib/session';

const PREFS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'order_updates', label: 'Order updates', hint: 'Shopping, delivery and changes to your order' },
  { key: 'agent_messages', label: 'Messages', hint: 'When someone writes to you in a chat' },
  { key: 'payment_reminders', label: 'Payment reminders', hint: 'Deposits and balances that are due' },
  { key: 'offers', label: 'Offers', hint: 'News and deals from Qyka' },
];

export default function Notifications() {
  const router = useRouter();
  const { user } = useSession();
  const { items, unread, loaded, error } = useNotifications();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefError, setPrefError] = useState('');

  useEffect(() => {
    void notificationStore.refresh();
    api
      .notificationPrefs()
      .then(setPrefs)
      .catch((e: Error) => setPrefError(e.message));
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
    setPrefError('');
    try {
      setPrefs(await api.setNotificationPrefs({ [key]: value }));
    } catch (e) {
      setPrefs(prefs);
      setPrefError((e as Error).message);
    }
  };

  // Opens the order a notification is about, in the part of the app this person is using.
  const open = (n: AppNotification) => {
    if (!n.is_read) void notificationStore.markRead(n.id);
    if (!n.order_id) return;
    const role = user?.role;
    if (role === 'rider') router.push('/rider');
    else if (role === 'agent') router.push(`/agent/orders/${n.order_id}`);
    else if (role === 'shopkeeper') router.push(`/shopkeeper/orders/${n.order_id}`);
    else router.push(`/customer/orders/${n.order_id}`);
  };

  const days: { label: string; rows: AppNotification[] }[] = [];
  items.forEach((n) => {
    const label = dayLabel(n.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(n);
    else days.push({ label, rows: [n] });
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-12 pt-3" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          {unread > 0 ? (
            <Pressable onPress={() => void notificationStore.markAllRead()} hitSlop={8} className="rounded-full border border-line-strong bg-surface px-4 py-2 active:bg-sunken">
              <Text className="text-xs font-bold text-ink">Mark all as read</Text>
            </Pressable>
          ) : null}
        </Animated.View>

        <PageHeader top="Your" accent="notifications" subtitle={unread > 0 ? `${unread} new` : "You're all caught up."} />

        {days.length === 0 ? (
          <View className="items-center rounded-3xl border border-line bg-surface px-6 py-8">
            <Text className="text-base font-bold text-ink">{loaded && error ? "Couldn't load notifications" : loaded ? 'Nothing yet' : 'Loading…'}</Text>
            <Text className="text-center text-sm text-muted">{loaded && error ? error : 'Updates about your orders and money show up here.'}</Text>
          </View>
        ) : (
          days.map((day, di) => (
            <Animated.View key={day.label} entering={FadeInDown.delay(di * 60).duration(400)} className="gap-2">
              <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{day.label}</Text>
              <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
                {day.rows.map((n, i) => (
                  <Pressable key={n.id} onPress={() => open(n)} className={'flex-row items-start gap-3 px-4 py-3.5 active:bg-sunken ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                    <View className={'mt-1.5 h-2.5 w-2.5 rounded-full ' + (n.is_read ? 'bg-transparent' : 'bg-brand-orange')} />
                    <View className="flex-1 gap-0.5">
                      <Text className={'text-sm leading-5 text-ink ' + (n.is_read ? '' : 'font-bold')}>{n.message}</Text>
                      <Text className="text-xs text-faint">{clockTime(n.created_at)}</Text>
                    </View>
                    {n.order_id ? <Text className="text-xl text-brand-orange-dark">›</Text> : null}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ))
        )}

        <View className="gap-2">
          <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">What you get</Text>
          <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
            {PREFS.map((p, i) => (
              <View key={p.key} className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-line' : '')}>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">{p.label}</Text>
                  <Text className="text-xs text-muted">{p.hint}</Text>
                </View>
                <Switch value={prefs ? prefs[p.key] : true} disabled={!prefs} onValueChange={(v) => void toggle(p.key, v)} trackColor={{ true: '#EE9A5A', false: '#E0DDD3' }} thumbColor="#FFFFFF" ios_backgroundColor="#E0DDD3" />
              </View>
            ))}
          </View>
          {prefError ? <Text className="ml-2 text-xs font-semibold text-red-700">{prefError}</Text> : <Text className="ml-2 text-xs text-faint">Payment due and out-for-delivery alerts are always sent.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
