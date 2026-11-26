import Inbox from '@/components/chat/Inbox';

export default function AgentMessages() {
  return <Inbox agent chatHref={(id) => `/agent/chat/${id}`} />;
}
