interface ZodLikeIssue {
  path: (string | number)[];
  message: string;
}

/** Client-safe (no native deps) — turns a zod error's `issues` array from
 * an API response into a field-name-keyed map for form display. */
export function issuesToFieldErrors(issues?: ZodLikeIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues ?? []) {
    const key = issue.path.join(".");
    if (key && !(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
