import {computed, inject, Injectable} from '@angular/core';
import {AccountService} from '../../../../core/account/services/account.service';
import {DefaultRolesCatalog} from '../../../../core/account/constants/default-roles-catalog.constants';
import {Vacation} from '../models/vacation.model';
import {VacationStatus} from '../enums/vacation-status.enum';

export type VacationStrategy = 'sysAdmin' | 'unitDirector' | 'departmentDirector' | 'default';

export interface VacationPermissions {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  canDownload: boolean;
  isAuthor: boolean;
  approveLabel: string;
}

@Injectable({providedIn: 'root'})
export class VacationPermissionsService {
  private readonly accountService = inject(AccountService);

  readonly strategy = computed<VacationStrategy>(() => {
    const roles = this.accountService.currentUser()?.roles ?? [];
    if (roles.includes(DefaultRolesCatalog.SYS_ADMIN)) return 'sysAdmin';
    if (roles.includes(DefaultRolesCatalog.UNIT_DIRECTOR)) return 'unitDirector';
    if (roles.includes(DefaultRolesCatalog.DEPARTMENT_DIRECTOR)) return 'departmentDirector';
    return 'default';
  });

  readonly canDecideOthers = computed(() => this.strategy() !== 'default');

  for(vacation: Vacation): VacationPermissions {
    const me = this.accountService.currentUser()?.employee;
    const strategy = this.strategy();
    const status = vacation.status;

    const isAuthor = !!me?.id && vacation.authorId === me.id;
    const myDepartmentId = me?.departmentId ?? me?.department?.id;
    const myUnitId = me?.department?.unitId ?? me?.department?.unit?.id;
    const departmentId = vacation.employee?.departmentId ?? vacation.employee?.department?.id;
    const unitId = vacation.employee?.department?.unitId ?? vacation.employee?.department?.unit?.id;
    const sameDepartment = !!departmentId && departmentId === myDepartmentId;
    const sameUnit = unitId && myUnitId ? unitId === myUnitId : true;
    const isOwnDraft = isAuthor && status === VacationStatus.None;
    const isOwnVacation = !!me?.id && vacation.employee?.id === me.id;

    let canView = false;
    let canApprove = false;
    let canReject = false;

    switch (strategy) {
      case 'sysAdmin':
        canView = true;
        canApprove = status !== VacationStatus.ApprovedByUnitDirector;
        canReject = status !== VacationStatus.Rejected;
        break;
      case 'unitDirector':
        canView = sameUnit;
        canApprove = sameUnit && status !== VacationStatus.ApprovedByUnitDirector;
        canReject = sameUnit && status !== VacationStatus.Rejected;
        break;
      case 'departmentDirector':
        canView = sameDepartment;
        canApprove = isOwnDraft || (sameDepartment
          && !isOwnVacation
          && status !== VacationStatus.ApprovedByUnitDirector
          && status !== VacationStatus.ApprovedByDepartmentDirector);
        canReject = sameDepartment
          && status !== VacationStatus.ApprovedByUnitDirector
          && status !== VacationStatus.Rejected;
        break;
      default:
        canView = isAuthor;
        canApprove = isAuthor && status === VacationStatus.None;
        canReject = false;
    }

    return {
      canView,
      canEdit: isAuthor && status === VacationStatus.None,
      canApprove,
      canReject,
      canDelete: strategy === 'sysAdmin'
        || (isAuthor && (status === VacationStatus.None || status === VacationStatus.PendingApproval)),
      canDownload: canView && status === VacationStatus.ApprovedByUnitDirector,
      isAuthor,
      approveLabel: strategy === 'default' || (strategy === 'departmentDirector' && isOwnDraft)
        ? 'Подати на погодження'
        : 'Погодити'
    };
  }
}
