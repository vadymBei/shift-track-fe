import {Role} from '../models/role.model';
import {RoleScope} from '../enums/role-scope.enum';
import {DefaultRolesCatalog} from './default-roles-catalog.constants';

export interface RoleMeta {
  icon: string;
  description: string;
}

const ROLE_META: Record<string, RoleMeta> = {
  [DefaultRolesCatalog.SYS_ADMIN]: {icon: 'pi pi-shield', description: 'Повний доступ до всіх розділів системи'},
  [DefaultRolesCatalog.UNIT_DIRECTOR]: {icon: 'pi pi-map', description: 'Керує регіоном і всіма його департаментами'},
  [DefaultRolesCatalog.DEPARTMENT_DIRECTOR]: {icon: 'pi pi-building', description: 'Керує департаментом: табель, відпустки, відрядження'},
  [DefaultRolesCatalog.DEPARTMENT_ADMIN]: {icon: 'pi pi-briefcase', description: 'Веде табель і заявки департаменту'},
  [DefaultRolesCatalog.DEPARTMENT_STYLIST]: {icon: 'pi pi-star', description: 'Робота з графіком змін департаменту'}
};

export function roleMeta(role: Role | null | undefined): RoleMeta {
  return (role && ROLE_META[role.name]) ?? {icon: 'pi pi-id-card', description: ''};
}

export function roleTitle(role: Role | null | undefined): string {
  return role?.title || role?.name || '';
}

export const ROLE_SCOPE_META: Record<RoleScope, {label: string; severity: 'success' | 'info' | 'secondary'}> = {
  [RoleScope.global]: {label: 'Глобальна', severity: 'success'},
  [RoleScope.local]: {label: 'Локальна', severity: 'info'},
  [RoleScope.none]: {label: 'Без області', severity: 'secondary'}
};
