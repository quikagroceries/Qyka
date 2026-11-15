"use client";

import Messages from "@/screens/shared/Messages";

export default function AgentMessagesPage() {
  return <Messages orderHref={(id) => `/agent/orders/${id}`} agent />;
}
