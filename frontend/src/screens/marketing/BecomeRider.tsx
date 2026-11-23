"use client";

import AuthShell from "@/components/auth/AuthShell";
import RiderApplicationWizard from "@/components/rider/RiderApplicationWizard";

export default function BecomeRider() {
  return (
    <AuthShell size="lg">
      <RiderApplicationWizard />
    </AuthShell>
  );
}
