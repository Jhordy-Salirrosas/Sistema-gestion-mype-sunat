export type DevelopmentFlag = 'MOCK_DECOLECTA' | 'SKIP_FILE_VALIDATION';

export function isDevelopmentFlagEnabled(flag: DevelopmentFlag): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env[flag]?.trim().toLowerCase() === 'true'
  );
}
