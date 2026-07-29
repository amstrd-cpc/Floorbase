import type { ZodIssue } from 'zod';

export function mapZodErrors(issues: ZodIssue[]) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'root', issue.message])
  );
}
