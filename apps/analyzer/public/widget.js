(function() {
  const currentScript = document.currentScript;
  const address = currentScript ? currentScript.getAttribute('data-address') : '';

  const btn = document.createElement('button');
  btn.innerText = 'Analyze This Deal';
  
  // Default Style
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    border: '1px solid #4f46e5',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(79, 70, 229, 0.2)',
    padding: '12px 24px',
    borderRadius: '9999px',
    fontFamily: '"SF Pro Display", "Inter", -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    zIndex: '999999',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  });

  // Inject logo visually using a pseudo-element logic or inline SVG
  const svgIcon = document.createElement('div');
  svgIcon.innerHTML = \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>\`;
  btn.prepend(svgIcon);

  // Hover effects
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(79, 70, 229, 0.4)';
    btn.style.backgroundColor = '#16213e';
  });
  
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(79, 70, 229, 0.2)';
    btn.style.backgroundColor = '#1a1a2e';
  });

  btn.addEventListener('click', () => {
    // Determine the base origin. If running locally or on domains other than clearpathanalyzer.com it can fallback to production
    const origin = 'https://clearpathanalyzer.com';
    const url = new URL(origin + '/');
    if (address && address.trim().length > 0) {
      url.searchParams.set('address', address);
    }
    window.open(url.toString(), '_blank');
  });

  // Ready state logic to ensure body is parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
  } else {
    document.body.appendChild(btn);
  }
})();
