'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          margin: 0,
          padding: '24px',
        }}
      >
        <h1 style={{ fontSize: '20px', margin: 0 }}>Tayyab Enterprises Management System</h1>
        <p style={{ color: '#475569', maxWidth: 520, textAlign: 'center', margin: 0 }}>
          The application ran into an unexpected error.
          {error?.message ? ` (${error.message})` : ''}
        </p>
        <button
          onClick={() => reset()}
          style={{
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#2563eb',
            color: 'white',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
