export interface PersonName {
  name?: string | null;
  surname?: string | null;
  fullName?: string | null;
}

export function personInitials(person: PersonName | string | null | undefined, order: 'surname-first' | 'name-first' = 'surname-first'): string {
  if (!person) return '';
  if (typeof person === 'string') return fromFullName(person);

  const first = order === 'surname-first' ? person.surname : person.name;
  const second = order === 'surname-first' ? person.name : person.surname;
  const parts = `${first?.charAt(0) ?? ''}${second?.charAt(0) ?? ''}`;
  return (parts || fromFullName(person.fullName)).toUpperCase();
}

function fromFullName(fullName: string | null | undefined): string {
  return (fullName ?? '').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
}

export function pluralUk(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
