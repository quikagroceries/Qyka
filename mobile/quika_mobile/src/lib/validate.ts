/** Small checks for the registration forms. They flag nonsense, they don't prove anything is real. */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** A Nigerian mobile number written as the 10 digits after +234 (spaces allowed), e.g. 801 234 5678. */
export const isNgMobile = (v: string) => /^[789][01]\d{8}$/.test(v.replace(/\D/g, ''));

/** A National Identification Number is exactly 11 digits. */
export const isNin = (v: string) => /^\d{11}$/.test(v);

/** dd/mm/yy or dd/mm/yyyy (also with - or .). Returns the date, or null if it isn't a real date. */
export function parseDate(v: string): Date | null {
  const m = v.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** Today as dd/mm/yyyy. */
export function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/** A Nigerian bank account number is 10 digits. */
export const isAccountNumber = (v: string) => /^\d{10}$/.test(v);

/** A vehicle plate: letters, numbers, spaces or dashes, 5 to 12 characters. */
export const isPlate = (v: string) => /^[A-Za-z0-9\- ]{5,12}$/.test(v.trim());
