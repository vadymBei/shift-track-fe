/**
 * Test data in the shape the API returns. Only the fields the pages use are filled.
 */

export const unit = {id: 1, name: 'Київ', code: 'KYV', fullName: 'KYV Київ'};
export const department = {id: 10, name: 'Магазин №12', unitId: 1, unit};

export interface TestUser {
  employee: ReturnType<typeof employee>;
  roles: string[];
}

export function employee(id: number, surname: string, name: string, positionName = 'Консультант') {
  return {
    id,
    surname,
    name,
    patronymic: '',
    fullName: `${surname} ${name}`,
    email: `user${id}@example.com`,
    departmentId: department.id,
    department,
    position: {id: 1, name: positionName},
    createdAt: '2025-01-15T09:00:00'
  };
}

export const users = {
  employee: {employee: employee(11, 'Коваль', 'Олена', 'Касир'), roles: []} as TestUser,
  departmentDirector: {employee: employee(1, 'Бей', 'Вадим', 'Директор магазину'), roles: ['department.director']} as TestUser,
  unitDirector: {employee: employee(2, 'Мельник', 'Андрій', 'Регіональний директор'), roles: ['unit.director']} as TestUser
};

export interface VacationPermissions {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  canDownload: boolean;
  approveSubmitsForApproval: boolean;
}

const noPermissions: VacationPermissions = {
  canView: false,
  canEdit: false,
  canApprove: false,
  canReject: false,
  canDelete: false,
  canDownload: false,
  approveSubmitsForApproval: false
};

export function permissions(allowed: Partial<VacationPermissions> = {}): VacationPermissions {
  return {...noPermissions, ...allowed};
}

export function vacation(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    type: 'YearMainVacation',
    status: 'PendingApproval',
    startDate: '2026-11-02T00:00:00',
    endDate: '2026-11-15T00:00:00',
    daysCount: 14,
    comment: '',
    createdAt: '2026-10-20T10:00:00',
    authorId: users.employee.employee.id,
    employee: users.employee.employee,
    permissions: permissions({canView: true}),
    ...overrides
  };
}

export function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: 500,
    type: 'VacationPendingApproval',
    moduleType: 'Vacation',
    entityId: 100,
    title: 'Нова заява на відпустку',
    message: 'Коваль Олена · Основна щорічна відпустка',
    createdAt: new Date().toISOString(),
    readAt: null,
    authorId: users.employee.employee.id,
    authorFullName: users.employee.employee.fullName,
    ...overrides
  };
}

export function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function vacationBalance(overrides: Record<string, unknown> = {}) {
  return {
    annualDays: 24,
    totalDays: 30.5,
    usedDays: 7,
    plannedDays: 5,
    availableDays: 18.5,
    workingYearStart: '2026-01-15T00:00:00',
    workingYearEnd: '2027-01-14T00:00:00',
    annualVacationAvailableFrom: '2025-07-15T00:00:00',
    ...overrides
  };
}
