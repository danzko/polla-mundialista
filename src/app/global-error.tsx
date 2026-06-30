'use client';

// Root-level error boundary: replaces the entire root layout when it
// crashes, so it must render its own <html>/<body> and cannot rely on
// globals.css being present.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050810',
          color: '#e6e9f0',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          {/* Inline SVG ball — self-contained (this boundary can't rely on Tailwind/globals.css) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 44 }}>😵‍💫</span>
            <svg width="44" height="44" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="geBody" cx="36%" cy="30%" r="78%">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.55" stopColor="#eef1f5" />
                  <stop offset="1" stopColor="#cbd3dd" />
                </radialGradient>
                <radialGradient id="geShade" cx="40%" cy="34%" r="72%">
                  <stop offset="0" stopColor="#000000" stopOpacity="0" />
                  <stop offset="0.72" stopColor="#000000" stopOpacity="0" />
                  <stop offset="1" stopColor="#0b1220" stopOpacity="0.34" />
                </radialGradient>
                <clipPath id="geClip"><circle cx="50" cy="50" r="46" /></clipPath>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#geBody)" />
              <g clipPath="url(#geClip)">
                <path d="M88.79 58.67 L89.26 72.72 L93.07 62.51 L94.95 42.14 L92.31 39.77 Z" fill="#17191e" />
                <path d="M34.56 21.64 L48.65 9.96 L40.72 5.11 L21.72 13.80 L17.92 24.01 Z" fill="#17191e" />
                <path d="M55.99 69.87 L44.54 83.93 L56.75 92.61 L75.74 83.93 L75.27 69.87 Z" fill="#17191e" />
                <path d="M39.58 58.67 L31.18 39.77 L14.54 42.14 L12.65 62.51 L28.13 72.72 Z" fill="#17191e" />
                <path d="M57.80 50.34 L77.08 50.34 L80.60 31.43 L63.50 19.75 L49.40 31.43 Z" fill="#17191e" />
              </g>
              <circle cx="50" cy="50" r="46" fill="url(#geShade)" />
              <ellipse cx="33" cy="31" rx="15" ry="10" fill="#ffffff" opacity="0.5" transform="rotate(-28 33 31)" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="1" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
            Algo salió mal / Something went wrong
          </h2>
          <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5, marginBottom: 20 }}>
            Tus pronósticos guardados están a salvo. Intenta de nuevo y si
            sigue fallando, avísanos en el grupo.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#00b84a',
              color: '#04130a',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Reintentar / Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: 10, opacity: 0.4, marginTop: 16, fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
