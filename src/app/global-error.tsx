'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <head>
        <style>
          {`
            .global-error { color: #1a1a1a; background: #fff; }
            .global-error-msg { color: #666; }
            .global-error-btn { border: 1px solid #e03131; background: #fff5f5; color: #e03131; }
            .global-error-btn:hover { background: #ffe3e3; }
            @media (prefers-color-scheme: dark) {
              .global-error { color: #e0e0e0; background: #1a1a1a; }
              .global-error-msg { color: #999; }
              .global-error-btn { border: 1px solid #ff6b6b; background: #2c1a1a; color: #ff6b6b; }
              .global-error-btn:hover { background: #3d2020; }
            }
          `}
        </style>
      </head>
      <body>
        <div
          className="global-error"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong!</h1>
          <p className="global-error-msg" style={{ marginBottom: '1.5rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="global-error-btn"
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
