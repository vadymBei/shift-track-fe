export const DefaultRolesCatalog = {
  SYS_ADMIN: "sys.admin",
  UNIT_DIRECTOR: "unit.director",
  DEPARTMENT_DIRECTOR: "department.director",
  DEPARTMENT_STYLIST: "department.stylist",
  DEPARTMENT_ADMIN: "department.admin"
} as const;

export const MANAGER_ROLES: string[] = [
  DefaultRolesCatalog.SYS_ADMIN,
  DefaultRolesCatalog.UNIT_DIRECTOR,
  DefaultRolesCatalog.DEPARTMENT_DIRECTOR
];
