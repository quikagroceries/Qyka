import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';

import CallScreen from '@/components/customer/CallScreen';
import AgentProfileSheet from '@/components/customer/AgentProfileSheet';
import { Avatar, SafeAreaView } from '@/components/ui';
import { clockTime, dayLabel } from '@/lib/format';
import { api, type ProposedAgent } from '@/lib/api';
import { isPending, useMessages } from '@/lib/chat';
import { useSession } from '@/lib/session';
import type { Conversation } from '@/lib/types';

const CAMERA = ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'];
const PHONE = ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'];
const SEND = ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'];

const Icon = ({ paths, color, size = 22, width = 2 }: { paths: string[]; color: string; size?: number; width?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d) => (
      <Path key={d} d={d} />
    ))}
  </Svg>
);

const QUICK_REPLIES = ['Hello', 'On it', 'Almost done', 'Thank you'];

/** One order's chat, live from the server. `backTo` is where the back arrow goes only when there is nothing to go back to (e.g. a deep link); otherwise it returns to where you came from; `who` names the other side. */
export default function ChatScreen({ orderId, backTo, who }: { orderId: string; backTo: string; who: 'Customer' | 'Your agent' }) {
  const router = useRouter();
  const { user } = useSession();
  const chat = useMessages(orderId);
  const messages = chat.messages;
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  // On the customer's side the other person is the shopping agent (their profile and phone come with the order); on the agent's side,
  // the customer comes from the inbox.
  const hasProfile = who === 'Your agent';
  const [agentInfo, setAgentInfo] = useState<ProposedAgent | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  useEffect(() => {
    let alive = true;
    if (who === 'Your agent') api.getOrderAgent(orderId).then((a) => alive && setAgentInfo(a)).catch(() => undefined);
    else api.getConversations().then((list) => alive && setConversation(list.find((c) => c.order_id === orderId) ?? null)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [orderId, who]);
  const other = hasProfile ? (agentInfo ? { id: agentInfo.id, full_name: agentInfo.full_name, avatar_url: agentInfo.avatar_url ?? null } : null) : (conversation?.other ?? null);
  // The server doesn't share the agent's number with the customer, so calls go through the app (a number appears only if the server sends one).
  const agent = agentInfo ? { id: agentInfo.id, full_name: agentInfo.full_name, avatar_url: agentInfo.avatar_url ?? null, phone: agentInfo.phone } : null;

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  // With the keyboard up there is no home indicator to clear, so the card sits close to it.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function sendImage(uri: string) {
    chat.send({ imageUri: uri });
  }

  async function pick(source: 'camera' | 'library') {
    try {
      const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(source === 'camera' ? 'Camera access is off' : 'Photo access is off', 'Turn it on for Qyka in your phone settings to send pictures.');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) sendImage(result.assets[0].uri);
    } catch {
      Alert.alert(source === 'camera' ? "The camera isn't available" : "Couldn't open your photos", source === 'camera' ? 'Try choosing a photo from your library instead.' : 'Please try again.');
    }
  }

  function addPhoto() {
    Alert.alert('Send a photo', undefined, [
      { text: 'Take a photo', onPress: () => pick('camera') },
      { text: 'Choose from library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function send(body: string) {
    if (!body) return;
    setText('');
    chat.send({ text: body });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-row items-center gap-2 border-b border-line bg-canvas px-3 py-2">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo as never))} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <Pressable
            disabled={!hasProfile}
            onPress={() => setProfileOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={hasProfile ? 'View agent profile' : undefined}
            className="flex-1 flex-row items-center gap-3 rounded-full py-0.5 pr-2 active:bg-sunken">
            <Avatar uri={other?.avatar_url} name={other?.full_name} className="h-9 w-9" />
            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="shrink text-base font-bold text-ink" numberOfLines={1}>
                  {other?.full_name || who}
                </Text>
                {hasProfile ? <Text className="text-xl leading-5 text-brand-orange-dark">›</Text> : null}
              </View>
              <Text className="text-xs text-muted">{hasProfile ? 'Your agent · tap for profile' : who}</Text>
            </View>
          </Pressable>
          {hasProfile && agent ? (
            <Pressable
              onPress={() => setCallOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${other?.full_name || 'your agent'}`}
              hitSlop={6}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-sunken">
              <Icon paths={PHONE} color="#1A1A1A" size={22} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView ref={scroller} className="flex-1" contentContainerClassName="px-4 py-3" keyboardShouldPersistTaps="handled">
          {!chat.loaded ? <Text className="py-16 text-center text-sm text-muted">Loading the conversation…</Text> : null}
          {chat.loaded && chat.error && messages.length === 0 ? (
            <View className="items-center gap-2 py-16">
              <Text className="max-w-[260px] text-center text-sm font-semibold text-red-700">{chat.error}</Text>
              <Pressable onPress={() => void chat.reload()} hitSlop={8}>
                <Text className="text-sm font-bold text-brand-orange-dark">Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {chat.loaded && !chat.error && messages.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text className="text-base font-bold text-ink">No messages yet</Text>
              <Text className="max-w-[220px] text-center text-sm text-faint">Say hello, or send a quick reply below to get things started.</Text>
            </View>
          ) : null}
          {messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const waiting = isPending(m) ? m : null;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const showDivider = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
            // Only the last bubble in a run gets the pointed corner and the time.
            const lastInRun = !next || next.sender_id !== m.sender_id || dayLabel(next.created_at) !== dayLabel(m.created_at);
            return (
              <View key={m.id}>
                {showDivider ? (
                  <View className="my-3 items-center">
                    <Text className="rounded-full bg-sunken px-3 py-1 text-[11px] font-semibold text-faint">{dayLabel(m.created_at)}</Text>
                  </View>
                ) : null}
                <View className={(mine ? 'items-end' : 'items-start') + (lastInRun ? ' mb-2' : ' mb-0.5')}>
                  <View
                    className={
                      'max-w-[80%] rounded-2xl px-3 py-2 ' +
                      (mine ? 'bg-brand-orange ' + (lastInRun ? 'rounded-br-sm' : '') : 'bg-sunken ' + (lastInRun ? 'rounded-bl-sm' : '')) +
                      (waiting?.pending === 'sending' ? ' opacity-60' : '')
                    }>
                    {m.text ? <Text className="text-sm text-ink">{m.text}</Text> : null}
                    {m.image_url ? (
                      <Pressable onPress={() => setPreview(m.image_url)} className={m.text ? 'mt-1.5' : ''}>
                        <Image source={{ uri: m.image_url }} className="h-48 w-56 rounded-lg" resizeMode="cover" />
                      </Pressable>
                    ) : null}
                  </View>
                  {waiting ? (
                    waiting.pending === 'failed' ? (
                      <View className="mt-0.5 flex-row items-center gap-2">
                        <Text className="text-[11px] font-semibold text-red-700">{waiting.error || 'Not sent.'}</Text>
                        <Pressable onPress={() => chat.retry(waiting.id)} hitSlop={6}>
                          <Text className="text-[11px] font-bold text-brand-orange-dark">Retry</Text>
                        </Pressable>
                        <Pressable onPress={() => chat.remove(waiting.id)} hitSlop={6}>
                          <Text className="text-[11px] font-bold text-muted">Remove</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text className="mt-0.5 text-[11px] text-faint">Sending…</Text>
                    )
                  ) : lastInRun ? (
                    <Text className="mt-0.5 text-[11px] text-faint">{clockTime(m.created_at)}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {chat.error && messages.length > 0 ? <Text className="px-4 pb-1 text-center text-xs font-semibold text-red-700">{chat.error} Trying again…</Text> : null}
        <View style={{ paddingBottom: keyboard ? 8 : Math.max(insets.bottom, 12), paddingHorizontal: 12, paddingTop: 6 }} className="gap-2">
          {text.trim().length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-1">
              {QUICK_REPLIES.map((r) => (
                <Pressable key={r} onPress={() => send(r)} className="rounded-full border border-brand-orange/40 bg-brand-orange/15 px-4 py-2 active:bg-brand-orange/30">
                  <Text className="text-sm font-bold text-brand-orange-dark">{r}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View
            className="flex-row items-end gap-1 rounded-[28px] border border-line bg-surface p-1.5"
            style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 6 }}>
            <Pressable onPress={addPhoto} accessibilityRole="button" accessibilityLabel="Send a photo" hitSlop={4} className="h-11 w-11 items-center justify-center rounded-full active:bg-sunken">
              <View style={{ marginTop: -3 }}>
                <Icon paths={CAMERA} color="#1A1A1A" size={24} />
              </View>
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor="#9B9B9B"
              multiline
              style={{ maxHeight: 120, paddingTop: 13, paddingBottom: 11, lineHeight: 20 }}
              className="font-body min-h-[44px] flex-1 px-1 text-base text-ink"
            />
            <Pressable
              onPress={() => send(text.trim())}
              disabled={text.trim().length === 0}
              accessibilityLabel="Send message"
              className={'h-11 w-11 items-center justify-center rounded-full ' + (text.trim() ? 'bg-brand-orange active:bg-brand-orange-dark' : 'bg-sunken')}
              style={({ pressed }) => ({ transform: [{ scale: pressed && text.trim() ? 0.94 : 1 }] })}>
              <Icon paths={SEND} color={text.trim() ? '#1A1A1A' : '#B9B3A8'} size={20} width={2.25} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {hasProfile ? <CallScreen person={agent} visible={callOpen} onClose={() => setCallOpen(false)} /> : null}
      {hasProfile ? <AgentProfileSheet person={agent} visible={profileOpen} onClose={() => setProfileOpen(false)} /> : null}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} className="flex-1 items-center justify-center bg-black/90 p-4">
          {preview ? <Image source={{ uri: preview }} className="h-full w-full" resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
