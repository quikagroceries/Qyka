"use client";

import { useParams } from "next/navigation";
import HubOrder from "@/screens/shopkeeper/HubOrder";

export default function ShopkeeperOrderPage() {
  const { id } = useParams();
  return <HubOrder orderId={String(id)} />;
}
