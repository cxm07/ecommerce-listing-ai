import authenticatedUserFixture from '../../../sample-data/api/v23/authenticated_user.json';
import type { AuthRepository, AuthSession, AuthUser, SignInInput } from './contracts';

interface AuthenticatedUserFixture {
  data: {
    id: string;
    email: string;
    roles: AuthUser['roles'];
  };
}

const fixture = authenticatedUserFixture as AuthenticatedUserFixture;

const fixtureSession = (): AuthSession => ({
  user: {
    ...fixture.data,
    display_name: '演示运营人员',
  },
});

export function createMockAuthRepository(): AuthRepository {
  let session: AuthSession | null = null;

  return {
    async getSession() {
      return session;
    },
    async signIn(input: SignInInput) {
      const nextSession = fixtureSession();
      session = {
        user: {
          ...nextSession.user,
          email: input.email.trim() || nextSession.user.email,
        },
      };
      return session;
    },
    async signOut() {
      session = null;
    },
  };
}
