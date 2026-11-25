import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Text } from '@/components/Text';

import { Avatar, ErrorBanner, SafeAreaView } from '@/components/ui';
import { api, type Conversation, type Message } from '@/lib/api';
import { clockTime, dayLabel, errMsg } from '@/lib/format';
import { useSession } from '@/lib/session';
import { takeAndUploadPhoto } from '@/lib/upload';
import { usePolling } from '@/lib/usePolling';

// Chat should feel live, so it polls quickly (paused while the app is in the
// background; usePolling handles that).
const POLL_MS = 5000;
const QUICK_REPLIES = ['Hello', 'On it', 'Almost done', 'Thank you'];

/** One order's chat. `backTo` is where the back arrow goes; `who` names the other side. */
export default function ChatScreen({ orderId, backTo, who }: { orderId: string; backTo: string; who: 'Customer' | 'Your agent' }) {
  const router = useRouter();
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<Conversation['other']>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const lastRead = useRef(0);

  const poll = useCallback(async () => {
    try {
      const msgs = await api.messages(orderId);
      setMessages(msgs);
      // Anything that arrives while the chat is open counts as seen.
      if (msgs.length !== lastRead.current) {
        lastRead.current = msgs.length;
        api.markChatRead(orderId).catch(() => {});
      }
    } catch {
      // A failed poll shouldn't interrupt the screen.
    }
  }, [orderId]);
  usePolling(poll, POLL_MS);

  // Who you're talking to comes from the inbox row for this order.
  useEffect(() => {
    api
      .conversations()
      .then((list) => setOther(list.find((c) => c.order_id === orderId)?.other ?? null))
      .catch(() => {});
  }, [orderId]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function send(body: { text?: string; image_url?: string }, clear = false) {
    setError(null);
    setBusy(true);
    try {
      await api.sendMessage(orderId, body);
      if (clear) setText('');
      await poll();
    } catch (e) {
      setError(`Could not send: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto() {
    setError(null);
    setUploading(true);
    try {
      const url = await takeAndUploadPhoto();
      if (url) await send({ image_url: url });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-row items-center gap-2 border-b border-line bg-canvas px-3 py-2">
          <Pressable onPress={() => router.replace(backTo as never)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <Avatar uri={other?.avatar_url} name={other?.full_name} className="h-9 w-9" />
          <View className="flex-1">
            <Text className="text-base font-bold text-ink" numberOfLines={1}>
              {other?.full_name || who}
            </Text>
            <Text className="text-xs text-muted">{who}</Text>
          </View>
        </View>

        <ScrollView ref={scroller} className="flex-1" contentContainerClassName="px-4 py-3" keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text className="text-base font-bold text-ink">No messages yet</Text>
              <Text className="max-w-[220px] text-center text-sm text-faint">Say hello, or send a quick reply below to get things started.</Text>
            </View>
          ) : null}
          {messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
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
                      (mine ? 'bg-brand-orange ' + (lastInRun ? 'rounded-br-sm' : '') : 'bg-sunken ' + (lastInRun ? 'rounded-bl-sm' : ''))
                    }>
                    {m.text ? <Text className="text-sm text-ink">{m.text}</Text> : null}
                    {m.image_url ? (
                      <Pressable onPress={() => setPreview(m.image_url)} className={m.text ? 'mt-1.5' : ''}>
                        <Image source={{ uri: m.image_url }} className="h-48 w-56 rounded-lg" resizeMode="cover" />
                      </Pressable>
                    ) : null}
                  </View>
                  {lastInRun ? <Text className="mt-0.5 text-[11px] text-faint">{clockTime(m.created_at)}</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View className="gap-2 border-t border-line px-4 py-3">
          <ErrorBanner message={error} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {QUICK_REPLIES.map((r) => (
              <Pressable
                key={r}
                disabled={busy}
                onPress={() => void send({ text: r })}
                className="rounded-full border border-line bg-surface px-3 py-1.5 active:border-brand-orange">
                <Text className="text-sm font-semibold text-muted">{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor="#9B9B9B"
              returnKeyType="send"
              onSubmitEditing={() => text.trim() && void send({ text: text.trim() }, true)}
              className="font-body min-h-[44px] flex-1 rounded-full border border-line-strong bg-surface px-4 text-base text-ink"
            />
            <Pressable onPress={() => void sendPhoto()} disabled={uploading} accessibilityLabel="Send a photo" className="h-11 w-11 items-center justify-center rounded-full bg-sunken active:bg-line-strong">
              <Text className="text-base text-muted">{uploading ? '…' : '📷'}</Text>
            </Pressable>
            <Pressable
              onPress={() => void send({ text: text.trim() }, true)}
              disabled={busy || !text.trim()}
              accessibilityLabel="Send message"
              className={'h-11 w-11 items-center justify-center rounded-full bg-brand-orange active:bg-brand-orange-dark ' + (busy || !text.trim() ? 'opacity-50' : '')}>
              <Text className="text-lg font-extrabold text-ink">↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} className="flex-1 items-center justify-center bg-black/90 p-4">
          {preview ? <Image source={{ uri: preview }} className="h-full w-full" resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
