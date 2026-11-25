import { useLocalSearchParams } from 'expo-router';

import ChatScreen from '@/components/chat/ChatScreen';

export default function AgentChat() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <ChatScreen orderId={orderId} backTo={`/agent/orders/${orderId}`} who="Customer" />;
}
