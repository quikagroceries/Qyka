import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import CallScreen from '@/components/customer/CallScreen';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import { Text } from '@/components/Text';
import { Avatar, Button, Float } from '@/components/ui';
import { AGENT_PROFILE, AGENT_REVIEWS, REVIEW_BREAKDOWN } from '@/lib/mock';
import type { Person } from '@/lib/types';

const PHONE =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';

const PhoneIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d={PHONE} />
  </Svg>
);

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <Text style={{ fontSize: size, letterSpacing: 1 }} className="text-brand-orange-dark">
    {'★'.repeat(n)}
    <Text style={{ fontSize: size }} className="text-line-strong">
      {'★'.repeat(5 - n)}
    </Text>
  </Text>
);

/** Rating summary with a bar per star count, then every review. */
function Reviews({ name, onBack }: { name: string; onBack: () => void }) {
  const { height } = useWindowDimensions();
  const p = AGENT_PROFILE;
  const max = Math.max(...Object.values(REVIEW_BREAKDOWN));
  return (
    <View>
      <View className="mt-3 flex-row items-center justify-between">
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back to profile" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
          <Text className="text-2xl text-ink">‹</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-xs font-semibold text-muted">Reviews for</Text>
          <Text className="text-sm font-extrabold text-ink">{name}</Text>
        </View>
        <View className="h-11 w-11" />
      </View>

      <ScrollView style={{ maxHeight: height * 0.68 }} contentContainerClassName="gap-3 pb-4 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-5 rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <View className="items-center gap-1">
            <Text className="text-[44px] font-extrabold leading-[48px] text-brand-orange-dark">{p.rating}</Text>
            <Stars n={5} />
            <Text className="text-[11px] font-semibold text-muted">{p.reviews} reviews</Text>
          </View>
          <View className="flex-1 gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <View key={n} className="flex-row items-center gap-2">
                <Text className="w-3 text-xs font-bold text-muted">{n}</Text>
                <View className="h-2 flex-1 overflow-hidden rounded-full bg-line-strong">
                  <View className="h-2 rounded-full bg-brand-orange" style={{ width: `${(REVIEW_BREAKDOWN[n] / max) * 100}%` }} />
                </View>
                <Text className="w-7 text-right text-[11px] text-faint">{REVIEW_BREAKDOWN[n]}</Text>
              </View>
            ))}
          </View>
        </View>

        {AGENT_REVIEWS.map((r) => (
          <View key={r.id} className="gap-1.5 rounded-3xl border border-line bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Stars n={r.stars} />
              <Text className="text-xs text-faint">{r.when}</Text>
            </View>
            <Text className="text-sm leading-5 text-ink">{r.text}</Text>
            <Text className="text-xs font-semibold text-muted">{r.by}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Bottom sheet with a shopping agent's profile, in the same language as the rest of the app:
 * a peach banner with the avatar sitting over its edge, a two-tone name, one stats card,
 * a customer quote, and a primary Chat button.
 */
export default function AgentProfileSheet({ person, visible, onClose, onChat }: { person: Person | null; visible: boolean; onClose: () => void; onChat?: () => void }) {
  const p = AGENT_PROFILE;
  const [view, setView] = useState<'profile' | 'reviews'>('profile');
  const close = () => {
    setView('profile');
    onClose();
  };
  const [first, ...rest] = (person?.full_name || 'Your agent').split(' ');
  const [calling, setCalling] = useState(false);
  const callPhone = person?.phone;
  // Close the sheet, then ring: the call screen takes over, and ending it returns to where you were.
  const call = () => {
    close();
    setCalling(true);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
        <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={close} accessibilityLabel="Close" />
          <Animated.View entering={SlideInDown.duration(320)} className="overflow-hidden rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
            <OrderBackdrop />
            <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />

            {view === 'reviews' ? (
              <Reviews name={person?.full_name || 'your agent'} onBack={() => setView('profile')} />
            ) : (
              <>
                <View className="mt-4 h-[104px] overflow-visible rounded-3xl bg-brand-orange/20">
                  <View className="absolute right-3 top-2">
                    <Float>
                      <Image source={require('../../../assets/illustrations/agent-customer-conversation.webp')} resizeMode="contain" style={{ width: 120, height: 90 }} />
                    </Float>
                  </View>
                  <View className="absolute -bottom-10 left-4 rounded-full border-4 border-canvas">
                    <Avatar uri={person?.avatar_url} name={person?.full_name} className="h-[88px] w-[88px]" />
                  </View>
                </View>

                <View className="mt-14 gap-2">
                  <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
                    {first}
                    {rest.length ? <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark"> {rest.join(' ')}</Text> : null}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="flex-row items-center gap-1 rounded-full bg-brand-green/20 px-3 py-1">
                <Text className="text-xs font-extrabold text-brand-army">✓</Text>
                <Text className="text-xs font-bold text-brand-army">Verified Qyka agent</Text>
              </View>
                    <Pressable
                      onPress={() => setView('reviews')}
                      accessibilityRole="button"
                      accessibilityLabel="See reviews"
                      className="flex-row items-center gap-1 rounded-full border border-line-strong bg-surface px-3 py-1 active:bg-sunken"
                    >
                      <Text className="text-xs text-brand-orange-dark">★</Text>
                      <Text className="text-xs font-bold text-ink">
                        {p.rating} <Text className="font-semibold text-muted">({p.reviews} reviews)</Text>
                      </Text>
                      <Text className="text-sm text-brand-orange-dark">›</Text>
                    </Pressable>
                  </View>
                </View>

                <View className="mt-4 flex-row items-center rounded-3xl border border-line bg-surface py-4 shadow-sm">
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="text-2xl font-extrabold text-ink">{p.ordersDone}</Text>
                    <Text className="text-[11px] font-semibold text-muted">Orders done</Text>
                  </View>
                  <View className="h-9 w-px bg-line-strong" />
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="text-2xl font-extrabold text-brand-orange-dark">{p.rating}</Text>
                    <Text className="text-[11px] font-semibold text-muted">Rating</Text>
                  </View>
                  <View className="h-9 w-px bg-line-strong" />
                  <View className="flex-1 items-center gap-0.5">
                    <Text className="text-2xl font-extrabold text-ink">{p.since}</Text>
                    <Text className="text-[11px] font-semibold text-muted">Agent since</Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wide text-faint">Shops at</Text>
                  {p.markets.map((m) => (
                    <View key={m} className="rounded-full border border-line-strong bg-surface px-3 py-1">
                      <Text className="text-xs font-bold text-ink">{m}</Text>
                    </View>
                  ))}
                </View>

                <View className="mt-3 gap-2 rounded-3xl border border-line bg-surface p-4">
                  <Text className="text-3xl font-extrabold leading-8 text-brand-orange">“</Text>
                  <Text className="text-sm leading-5 text-ink">{p.review.quote}</Text>
                  <Text className="text-xs font-semibold text-muted">{p.review.by}</Text>
                  <Pressable onPress={() => setView('reviews')} hitSlop={8} className="mt-1 self-start">
                    <Text className="text-sm font-bold text-brand-orange-dark">See all {p.reviews} reviews ›</Text>
                  </Pressable>
                </View>

                <View className="mt-4 flex-row items-center gap-3">
                  {onChat ? (
                    <>
                      <Button
                        label="Chat with agent"
                        className="flex-1"
                        onPress={() => {
                          close();
                          onChat();
                        }}
                      />
                      {callPhone ? (
                        <Pressable
                          onPress={call}
                          accessibilityRole="button"
                          accessibilityLabel="Call agent"
                          className="h-[54px] w-[54px] items-center justify-center rounded-full border border-line-strong bg-surface active:bg-sunken"
                        >
                          <PhoneIcon color="#D9702F" />
                        </Pressable>
                      ) : null}
                    </>
                  ) : callPhone ? (
                    <Button label="Call agent" className="flex-1" onPress={call} icon={<PhoneIcon color="#1A1A1A" />} />
                  ) : null}
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
      <CallScreen person={person} visible={calling} onClose={() => setCalling(false)} />
    </>
  );
}
