export function inSelectedMonth(date: string, month?: string): boolean {
  return !month || date.slice(0, 7) === month;
}
