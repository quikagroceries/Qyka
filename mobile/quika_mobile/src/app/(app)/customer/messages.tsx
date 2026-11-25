import Inbox from '@/components/chat/Inbox';

export default function CustomerMessages() {
  return <Inbox agent={false} chatHref={(id) => `/customer/chat/${id}`} />;
}
