import EarningsView from '@/components/EarningsView';
import { api } from '@/lib/api';

export default function RiderEarnings() {
  return <EarningsView load={api.riderEarnings} subtitle="Paid per delivery, once the customer confirms they received it." />;
}
