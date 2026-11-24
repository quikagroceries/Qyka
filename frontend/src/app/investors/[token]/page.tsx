"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import CompanyOverview from "@/components/company/CompanyOverview";
import Card from "@/components/ui/Card";
import logo from "@/assets/logo.png";

// What an investor sees: the company overview and nothing else - no menu, no
// sign-in, no way to anything beyond this page. It works only while the link
// is live; revoking or letting it expire turns it off at once.
export default function InvestorPage() {
  const { token } = useParams();
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getInvestorOverview(String(token), Number(period))
      .then((d) => live && setData(d))
      .catch((e) => live && String(e.message).startsWith("404") ? setInvalid(true) : null)
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [token, period]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Image src={logo} alt="Qyka" className="h-8 w-auto object-contain" priority />
          <div>
            <p className="font-display text-lg font-extrabold leading-tight text-ink">Company overview</p>
            <p className="text-xs text-faint">Shared with you by Qyka · read-only</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {invalid ? (
          <Card className="mx-auto max-w-md text-center">
            <p className="font-display text-xl font-extrabold text-ink">This link isn&apos;t valid</p>
            <p className="mt-2 text-sm text-muted">It may have expired or been switched off. Ask the person who sent it for a new one.</p>
          </Card>
        ) : (
          <CompanyOverview data={data} loading={loading} period={period} onPeriod={setPeriod} />
        )}
      </main>
    </div>
  );
}
