import { describe, expect, it } from 'vitest';

import { createMockAuthRepository } from './mockAuthRepository';

describe('mock auth repository', () => {
  it('starts signed out and exposes the V23 fixture user after sign-in', async () => {
    const repository = createMockAuthRepository();

    await expect(repository.getSession()).resolves.toBeNull();

    const session = await repository.signIn({ email: 'demo@example.invalid' });

    expect(session).toEqual({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'demo@example.invalid',
        display_name: '演示运营人员',
        roles: ['operator'],
      },
    });
    await expect(repository.getSession()).resolves.toEqual(session);
  });

  it('clears the session after sign-out', async () => {
    const repository = createMockAuthRepository();
    await repository.signIn({ email: 'demo@example.invalid' });

    await repository.signOut();

    await expect(repository.getSession()).resolves.toBeNull();
  });
});
