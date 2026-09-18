export const MINIMUM_AGE_YEARS = 18;

export function isOldEnough(
  dateOfBirth: Date,
  now: Date = new Date(),
  minimumAge: number = MINIMUM_AGE_YEARS,
): boolean {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age >= minimumAge;
}
