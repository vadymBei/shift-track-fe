import {computed, inject, Injectable} from '@angular/core';
import {AccountService} from '../../../../core/account/services/account.service';
import {DefaultRolesCatalog} from '../../../../core/account/constants/default-roles-catalog.constants';
import {BusinessTrip} from '../models/business-trip.model';
import {BusinessTripStatus} from '../enums/business-trip-status.enum';

export type BusinessTripStrategy = 'sysAdmin' | 'unitDirector' | 'default';

export interface BusinessTripPermissions {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  canDownload: boolean;
  isAuthor: boolean;
  isParticipant: boolean;
}

@Injectable({providedIn: 'root'})
export class BusinessTripPermissionsService {
  private readonly accountService = inject(AccountService);

  readonly strategy = computed<BusinessTripStrategy>(() => {
    const roles = this.accountService.currentUser()?.roles ?? [];
    if (roles.includes(DefaultRolesCatalog.SYS_ADMIN)) return 'sysAdmin';
    if (roles.includes(DefaultRolesCatalog.UNIT_DIRECTOR)) return 'unitDirector';
    return 'default';
  });

  readonly canDecideOthers = computed(() => this.strategy() !== 'default');

  for(trip: BusinessTrip): BusinessTripPermissions {
    const me = this.accountService.currentUser()?.employee;
    const strategy = this.strategy();
    const status = trip.status;
    const participants = trip.participants ?? [];

    const isAuthor = !!me?.id && trip.authorId === me.id;
    const isParticipant = !!me?.id && participants.some(p => p.id === me.id);
    const myUnitId = me?.department?.unitId ?? me?.department?.unit?.id;
    const participantUnits = participants.map(p => p.department?.unitId ?? p.department?.unit?.id);
    const inMyUnit = myUnitId && participantUnits.every(Boolean)
      ? participantUnits.includes(myUnitId)
      : participants.length > 0;

    let canView: boolean;
    let canManage: boolean;
    let canChangeStatus: boolean;

    switch (strategy) {
      case 'sysAdmin':
        canView = true;
        canManage = true;
        canChangeStatus = true;
        break;
      case 'unitDirector':
        canView = isAuthor || isParticipant || inMyUnit;
        canManage = isAuthor || inMyUnit;
        canChangeStatus = inMyUnit;
        break;
      default:
        canView = isAuthor || isParticipant;
        canManage = isAuthor
          && (status === BusinessTripStatus.PendingApproval || status === BusinessTripStatus.Rejected);
        canChangeStatus = false;
    }

    return {
      canView,
      canEdit: canManage && status !== BusinessTripStatus.Approved,
      canApprove: canChangeStatus && status !== BusinessTripStatus.Approved,
      canReject: canChangeStatus && status !== BusinessTripStatus.Rejected,
      canDelete: canManage,
      canDownload: canView && status === BusinessTripStatus.Approved,
      isAuthor,
      isParticipant
    };
  }
}
