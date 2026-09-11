import { format, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';

export function calculateAge(dob: string | undefined): string {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 'N/A';

  const now = new Date();
  const years = differenceInYears(now, birthDate);
  const months = differenceInMonths(now, birthDate) % 12;
  const days = differenceInDays(now, birthDate) % 30;

  if (years > 0) {
    return `${years}y ${months}m`;
  } else if (months > 0) {
    return `${months}m ${days}d`;
  } else {
    return `${days}d`;
  }
}

export function calculateTimeOnFarm(dateAcquired: string | undefined, dateRegistered: string | undefined): string {
  const startDateStr = dateAcquired || dateRegistered;
  if (!startDateStr) return 'N/A';
  
  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return 'N/A';

  const now = new Date();
  const years = differenceInYears(now, startDate);
  const months = differenceInMonths(now, startDate) % 12;
  const days = differenceInDays(now, startDate) % 30;

  if (years > 0) {
    return `${years}y ${months}m ${days}d`;
  } else if (months > 0) {
    return `${months}m ${days}d`;
  } else {
    return `${days}d`;
  }
}
