"use client";

import { api } from "@/lib/api";
import DeliveryEarnings from "@/screens/shared/DeliveryEarnings";

export default function HubEarnings() {
  return (
    <DeliveryEarnings
      load={api.getHubEarnings}
      body="You earn a fixed fee for every order that goes through your hub. It counts once the customer confirms they received it."
      emptyBody="Your first fee shows up here once a customer confirms an order that went through your hub."
    />
  );
}
