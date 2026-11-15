"use client";

import Messages from "@/screens/shared/Messages";

export default function MessagesPage() {
  return <Messages orderHref={(id) => `/orders/${id}`} />;
}
