export const AUTH_ENDPOINTS = [
  'system/auth/tokens/generate',
  'system/auth/tokens/refresh',
  'system/auth/account/register'
];

export function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
}
