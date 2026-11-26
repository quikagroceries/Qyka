import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Message } from '@/lib/types';

// Chat from the server. There is no push yet, so an open screen asks again every few seconds.

/** A message that has been typed or picked but not confirmed by the server yet. */
export type PendingMessage = Message & { pending: 'sending' | 'failed'; error?: string };
export type ChatMessage = Message | PendingMessage;
export const isPending = (m: ChatMessage): m is PendingMessage => 'pending' in m;

/** One order's chat: the messages, sending (with photos), and what to show while a message is on its way or failed. */
export function useMessages(orderId: string, ms = 4000) {
  const { user } = useSession();
  const me = user?.id ?? '';
  const [server, setServer] = useState<Message[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const readCount = useRef(0);
  const seq = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await api.getMessages(orderId);
      setServer(list);
      setError('');
      // Tell the server we've seen the other person's new messages (so their unread count clears).
      const fromOther = list.filter((m) => m.sender_id !== me).length;
      if (fromOther > readCount.current) {
        readCount.current = fromOther;
        void api.markChatRead(orderId).catch(() => undefined);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [orderId, me]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), ms);
    return () => clearInterval(t);
  }, [load, ms]);

  const deliver = useCallback(
    async (item: PendingMessage) => {
      try {
        // A photo goes to Cloudinary first; the message then carries its link.
        const image = item.image_url ? await api.uploadImage(item.image_url) : undefined;
        const sent = await api.sendMessage(orderId, { ...(item.text ? { text: item.text } : {}), ...(image ? { image_url: image } : {}) });
        setServer((cur) => (cur.some((m) => m.id === sent.id) ? cur : [...cur, sent]));
        setPending((cur) => cur.filter((p) => p.id !== item.id));
      } catch (e) {
        setPending((cur) => cur.map((p) => (p.id === item.id ? { ...p, pending: 'failed', error: (e as Error).message } : p)));
      }
    },
    [orderId],
  );

  const send = useCallback(
    (input: { text?: string; imageUri?: string }) => {
      const item: PendingMessage = {
        id: `pending-${++seq.current}`,
        order_id: orderId,
        sender_id: me,
        text: input.text ?? null,
        image_url: input.imageUri ?? null,
        created_at: new Date().toISOString(),
        pending: 'sending',
      };
      setPending((cur) => [...cur, item]);
      void deliver(item);
    },
    [orderId, me, deliver],
  );

  const retry = useCallback(
    (id: string) => {
      const item = pending.find((p) => p.id === id);
      if (!item) return;
      const again: PendingMessage = { ...item, pending: 'sending', error: undefined };
      setPending((cur) => cur.map((p) => (p.id === id ? again : p)));
      void deliver(again);
    },
    [pending, deliver],
  );

  const remove = useCallback((id: string) => setPending((cur) => cur.filter((p) => p.id !== id)), []);

  const messages: ChatMessage[] = [...server, ...pending];
  return { messages, loaded, error, send, retry, remove, reload: load };
}
