'use client'
import Script from 'next/script'

export function ErudaDebug() {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/eruda" strategy="beforeInteractive" />
      <Script id="eruda-init" strategy="afterInteractive">{`
        try { eruda.init(); } catch(e) {}
        window.addEventListener('error', function(ev) {
          try { eruda.init(); console.error('[ERR]', ev.message, ev.filename + ':' + ev.lineno); } catch(e2) {}
        });
        window.addEventListener('unhandledrejection', function(ev) {
          try { eruda.init(); console.error('[PROMISE]', String(ev.reason)); } catch(e2) {}
        });
      `}</Script>
    </>
  )
}