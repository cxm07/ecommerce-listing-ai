export type UserRole = 'operator' | 'reviewer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  roles: UserRole[];
}

export interface AuthSession {
  user: AuthUser;
}

export interface SignInInput {
  email: string;
}

export interface AuthRepository {
  getSession(): Promise<AuthSession | null>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
}
