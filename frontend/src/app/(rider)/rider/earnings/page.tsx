"use client";

import { api } from "@/lib/api";
import DeliveryEarnings from "@/screens/shared/DeliveryEarnings";
import riderArt from "@/assets/illustrations/earn-payout-moment.webp";

export default function RiderEarningsPage() {
  return (
    <DeliveryEarnings
      load={api.getRiderEarnings}
      body="You earn a fixed fee for every delivery. It counts once the customer confirms they received their order."
      emptyBody="Finish your first delivery and it shows up here once the customer confirms."
      illustration={riderArt}
    />
  );
}
