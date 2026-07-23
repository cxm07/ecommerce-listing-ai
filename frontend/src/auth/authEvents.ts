export const authUnauthorizedEvent = 'ecommerce-listing-ai:unauthorized';

export function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(authUnauthorizedEvent));
  }
}
