import { ServerEarnings } from '@/components/EarningsView';

export default function HubEarnings() {
  return <ServerEarnings kind="hub" unit="orders" subtitle="Your hub fee for each order handed to a rider, once the customer confirms." />;
}
