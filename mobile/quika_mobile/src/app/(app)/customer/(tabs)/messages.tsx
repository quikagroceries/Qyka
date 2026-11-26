import GuestGate from '@/components/GuestGate';
import Inbox from '@/components/chat/Inbox';
import { useSession } from '@/lib/session';

export default function CustomerMessages() {
  const { guest } = useSession();
  if (guest)
    return <GuestGate art={require('../../../../../assets/illustrations/phone-shopping-list.webp')} top="Chat with" accent="your agent" body="Sign in to message your agent and the vendors once you've placed an order." reason="Sign in to chat with your agent." />;
  return <Inbox agent={false} chatHref={(id) => `/customer/chat/${id}`} />;
}
