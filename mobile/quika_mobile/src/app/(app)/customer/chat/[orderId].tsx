import { useLocalSearchParams } from 'expo-router';

import ChatScreen from '@/components/chat/ChatScreen';

export default function CustomerChat() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <ChatScreen orderId={orderId} backTo={`/customer/orders/${orderId}`} who="Your agent" />;
}
