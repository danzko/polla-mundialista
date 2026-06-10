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
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵‍💫⚽</div>
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
