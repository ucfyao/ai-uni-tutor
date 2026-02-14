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
      <body>
        <div
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
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #e03131',
              background: '#fff5f5',
              color: '#e03131',
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
