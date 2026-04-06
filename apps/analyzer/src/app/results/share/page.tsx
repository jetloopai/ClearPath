import { Metadata, ResolvingMetadata } from 'next';
import { redirect } from 'next/navigation';

export async function generateMetadata(
  { searchParams }: { searchParams: { [key: string]: string | string[] | undefined } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const address = typeof searchParams.address === 'string' ? searchParams.address : 'Sample Property';
  const arv = typeof searchParams.arv === 'string' ? searchParams.arv : '0';
  const flipProfit = typeof searchParams.flipProfit === 'string' ? searchParams.flipProfit : '0';
  const cashFlow = typeof searchParams.cashFlow === 'string' ? searchParams.cashFlow : '0';
  const condition = typeof searchParams.condition === 'string' ? searchParams.condition : 'medium';
  const signal = typeof searchParams.signal === 'string' ? searchParams.signal : 'yellow';

  const fmt = (v: string) => {
    const num = Number(v) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const ogUrl = new URL('https://clearpathanalyzer.com/api/og');
  ogUrl.searchParams.set('address', address);
  ogUrl.searchParams.set('arv', arv);
  ogUrl.searchParams.set('flipProfit', flipProfit);
  ogUrl.searchParams.set('cashFlow', cashFlow);
  ogUrl.searchParams.set('condition', condition);
  ogUrl.searchParams.set('signal', signal);

  // Suppress unused parent warning
  void parent;

  return {
    title: `Deal Analysis: ${address}`,
    description: `ARV: ${fmt(arv)} | Flip: ${fmt(flipProfit)} | Cash Flow: ${fmt(cashFlow)}/mo`,
    openGraph: {
      title: `Deal Analysis: ${address}`,
      description: `ARV: ${fmt(arv)} | Flip: ${fmt(flipProfit)} | Cash Flow: ${fmt(cashFlow)}/mo`,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: 'ClearPath Deal Analysis',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Deal Analysis: ${address}`,
      description: `ARV: ${fmt(arv)} | Flip: ${fmt(flipProfit)} | Cash Flow: ${fmt(cashFlow)}/mo`,
      images: [ogUrl.toString()],
    },
  };
}

export default function ShareRedirectPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const address = typeof searchParams.address === 'string' ? searchParams.address : '';

  // Lightweight Server Component that provides OG tags.
  // Redirects users who land here to the homepage to run their own analysis.
  redirect(`/?address=${encodeURIComponent(address)}`);
}
