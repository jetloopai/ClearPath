import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const fmt = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const address = searchParams.get('address') || 'Sample Property Address';
    const arv = Number(searchParams.get('arv')) || 0;
    const flipProfit = Number(searchParams.get('flipProfit')) || 0;
    const cashFlow = Number(searchParams.get('cashFlow')) || 0;
    const signal = searchParams.get('signal') || 'yellow';
    const condition = searchParams.get('condition') || 'medium';

    const sigLabel = signal === 'green' ? '🟢 Strong Deal' : signal === 'red' ? '🔴 Weak Deal' : '🟡 Marginal Deal';
    const sigColor = signal === 'green' ? '#34d399' : signal === 'red' ? '#f87171' : '#fbbf24';
    const sigBg = signal === 'green' ? 'rgba(52, 211, 153, 0.1)' : signal === 'red' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(251, 191, 36, 0.1)';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#050505',
            backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050505 70%)',
            fontFamily: '"SF Pro Display", "Inter", sans-serif',
            color: 'white',
            padding: '60px 80px',
            position: 'relative',
          }}
        >
          {/* Top Logo */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#818cf8', letterSpacing: '-0.02em', display: 'flex' }}>
              ClearPath Analyzer
            </div>
            {/* Condition Badge */}
            <div style={{
              display: 'flex',
              padding: '8px 24px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 24,
              color: '#94a3b8',
              textTransform: 'capitalize',
            }}>
              {condition} Condition
            </div>
          </div>

          {/* Main Address */}
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <div style={{ fontSize: 72, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.04em', display: 'flex' }}>
              {address}
            </div>
          </div>

          {/* Bottom Stats */}
          <div style={{ display: 'flex', width: '100%', gap: '32px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px' }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex' }}>
                ARV
              </div>
              <div style={{ fontSize: 56, fontWeight: 700, display: 'flex' }}>
                {fmt(arv)}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px' }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex' }}>
                Flip Profit
              </div>
              <div style={{ fontSize: 56, fontWeight: 700, color: sigColor, display: 'flex' }}>
                {flipProfit >= 0 ? '+' : ''}{fmt(flipProfit)}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px' }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex' }}>
                Cash Flow
              </div>
              <div style={{ fontSize: 56, fontWeight: 700, display: 'flex' }}>
                {cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)}<span style={{ fontSize: 32, color: '#64748b', marginLeft: '8px', marginTop: '18px' }}>/mo</span>
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '60px', left: '80px', display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', padding: '12px 32px', borderRadius: '999px',
              background: sigBg, color: sigColor, border: `1px solid ${sigColor}40`,
              fontSize: 28, fontWeight: 600, alignItems: 'center', gap: '12px'
            }}>
              {sigLabel}
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '60px', right: '80px', display: 'flex' }}>
            <div style={{ fontSize: 28, color: '#475569', fontWeight: 500, letterSpacing: '0.05em', display: 'flex' }}>
              clearpath.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(`OG image generation failed: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
