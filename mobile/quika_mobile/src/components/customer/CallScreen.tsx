import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import { Text } from '@/components/Text';
import { Avatar, SafeAreaView } from '@/components/ui';
import type { Person } from '@/lib/types';

const MIC = ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'];
const SPEAKER = ['M11 5 6 9H2v6h4l5 4V5Z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'];
const CHAT = ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'];
const PHONE = [
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
];

const Icon = ({ paths, color, size = 26 }: { paths: string[]; color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d) => (
      <Path key={d} d={d} />
    ))}
  </Svg>
);

/** An expanding, fading ring that makes the avatar look like it's ringing. */
function Ring({ delay, active }: { delay: number; active: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    if (active) p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1));
  }, [p, delay, active]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.45,
    transform: [{ scale: 1 + p.value * 0.9 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: '#EE9A5A',
        },
        style,
      ]}
    />
  );
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Control({ label, paths, on, onPress }: { label: string; paths: string[]; on?: boolean; onPress: () => void }) {
  return (
    <View className="items-center gap-2">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={'h-16 w-16 items-center justify-center rounded-full border ' + (on ? 'border-ink bg-ink' : 'border-line bg-surface')}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Icon paths={paths} color={on ? '#FFFFFF' : '#1A1A1A'} />
        {label === 'Mute' && on ? <View className="absolute h-0.5 w-8 rotate-45 rounded-full bg-white" /> : null}
      </Pressable>
      <Text className="text-xs font-semibold text-muted">{label}</Text>
    </View>
  );
}

/** The call itself. It mounts when a call starts, so every call begins fresh: ringing, 00:00. */
function Call({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const connect = setTimeout(() => setConnected(true), 2600);
    return () => clearTimeout(connect);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [connected]);

  const [first, ...rest] = (person?.full_name || 'Your agent').split(' ');

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <OrderBackdrop />
      <View className="flex-1 items-center justify-between px-6 pb-8 pt-10">
        <View className="items-center gap-2">
          <Text className="text-sm font-semibold text-muted">{connected ? 'Qyka call' : 'Calling…'}</Text>
          <Text className="text-center text-[32px] font-extrabold leading-[38px] tracking-tight text-ink">
            {first}
            {rest.length ? <Text className="text-[32px] font-extrabold leading-[38px] tracking-tight text-brand-orange-dark"> {rest.join(' ')}</Text> : null}
          </Text>
          <Text className={'text-base font-semibold ' + (connected ? 'text-brand-orange-dark' : 'text-muted')}>{connected ? clock(seconds) : 'Ringing'}</Text>
          {person?.phone ? <Text className="text-sm text-faint">{person.phone}</Text> : null}
        </View>

        <View className="h-[300px] items-center justify-center">
          <Ring delay={0} active={!connected} />
          <Ring delay={1100} active={!connected} />
          <View className="rounded-full border-4 border-canvas">
            <Avatar uri={person?.avatar_url} name={person?.full_name} className="h-[140px] w-[140px]" />
          </View>
        </View>

        <View className="w-full items-center gap-8">
          <View className="w-full flex-row justify-around">
            <Control label="Mute" paths={MIC} on={muted} onPress={() => setMuted((m) => !m)} />
            <Control label="Speaker" paths={SPEAKER} on={speaker} onPress={() => setSpeaker((s) => !s)} />
            <Control label="Message" paths={CHAT} onPress={onClose} />
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="End call"
            className="h-[72px] w-[72px] items-center justify-center rounded-full bg-danger active:opacity-80"
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <View style={{ transform: [{ rotate: '135deg' }] }}>
              <Icon paths={PHONE} color="#FFFFFF" size={30} />
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * A full-screen call. UI only: there is no calling backend, so it rings for a couple of
 * seconds, "connects", and runs a timer until you end it.
 */
export default function CallScreen({ person, visible, onClose }: { person: Person | null; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <Call person={person} onClose={onClose} /> : null}
    </Modal>
  );
}
