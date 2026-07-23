import { describe, expect, it, vi } from 'vitest';

import { authUnauthorizedEvent, notifyUnauthorized } from './authEvents';

describe('auth events', () => {
  it('dispatches the shared unauthorized event', () => {
    const listener = vi.fn();
    window.addEventListener(authUnauthorizedEvent, listener);

    notifyUnauthorized();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(authUnauthorizedEvent, listener);
  });
});
