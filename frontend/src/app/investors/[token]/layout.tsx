// Never indexed, never cached by search engines: the link is the only way in.
export const metadata = {
  title: "Qyka — company overview",
  robots: { index: false, follow: false, nocache: true },
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
