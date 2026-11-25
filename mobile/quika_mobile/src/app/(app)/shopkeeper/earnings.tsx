import EarningsView from '@/components/EarningsView';
import { api } from '@/lib/api';

export default function HubEarnings() {
  return <EarningsView load={api.hubEarnings} subtitle="Your hub fee for each order handed to a rider, once the customer confirms." />;
}
