'use client';

import * as React from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(
      () => {
        setDebounced(value);
      },
      value === '' ? 0 : delayMs
    );
    return () => clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
}
