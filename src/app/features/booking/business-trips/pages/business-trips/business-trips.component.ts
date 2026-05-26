import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {catchError, of, Subject, takeUntil} from "rxjs";
import {BusinessTripService} from "../../services/business-trip.service";
import {BusinessTripStatus} from "../../enums/business-trip-status.enum";
import {FilteredBusinessTripsRequest} from "../../models/filtered-business-trips-request.model";
import {BusinessTrip} from "../../models/business-trip.model";
import moment from "moment/moment";
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {DatePipe, NgClass} from "@angular/common";
import {
  DeleteConfirmationModalComponent
} from "../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component";
import {BsModalService} from "ngx-bootstrap/modal";
import {
  EditBusinessTripModalComponent
} from "../../components/edit-business-trip-modal/edit-business-trip-modal.component";
import {
  CreateBusinessTripModalComponent
} from "../../components/create-business-trip-modal/create-business-trip-modal.component";
import {Unit} from "../../../../organization/structure/models/unit.model";
import {Department} from "../../../../organization/structure/models/department.model";
import {debounceTime} from "rxjs/operators";
import {DepartmentService} from "../../../../organization/structure/services/department.service";
import {UnitService} from "../../../../organization/structure/services/unit.service";
import {AccountService} from "../../../../../core/account/services/account.service";

@Component({
  selector: 'app-business-trips',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NgClass
  ],
  templateUrl: './business-trips.component.html',
  styleUrl: './business-trips.component.scss'
})
export class BusinessTripsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  private readonly modalService = inject(BsModalService);
  private readonly fb = inject(FormBuilder);
  private readonly businessTripService = inject(BusinessTripService);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly accountService = inject(AccountService);

  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal(false);
  businessTrips = signal<BusinessTrip[]>([]);
  request = signal<FilteredBusinessTripsRequest>({
    startDate: new Date(),
    endDate: new Date(),
    searchPattern: '',
    departmentId: 0
  });

  private readonly STATUS_BORDER_CLASS: Record<BusinessTripStatus | string, string> = {
    [BusinessTripStatus.Approved]: 'border-success',
    [BusinessTripStatus.PendingApproval]: 'border-warning',
    [BusinessTripStatus.Rejected]: 'border-danger',
    [BusinessTripStatus.None]: 'border-secondary'
  };

  getStatusBorderClass(status?: BusinessTripStatus | string): string {
    if (!status) return this.STATUS_BORDER_CLASS[BusinessTripStatus.None];
    return this.STATUS_BORDER_CLASS[status as BusinessTripStatus] || this.STATUS_BORDER_CLASS[BusinessTripStatus.None];
  }

  private readonly STATUS_BADGE_CLASS: Record<BusinessTripStatus | string, string> = {
    [BusinessTripStatus.Approved]: 'text-success bg-success-subtle',
    [BusinessTripStatus.PendingApproval]: 'text-warning bg-warning-subtle',
    [BusinessTripStatus.Rejected]: 'text-danger bg-danger-subtle',
    [BusinessTripStatus.None]: 'text-secondary bg-secondary-subtle'
  };

  private readonly STATUS_LABEL: Record<BusinessTripStatus | string, string> = {
    [BusinessTripStatus.Approved]: 'Підтверджено',
    [BusinessTripStatus.PendingApproval]: 'Очікує підтвердження',
    [BusinessTripStatus.Rejected]: 'Відхилено',
    [BusinessTripStatus.None]: 'Невідомо'
  };

  getStatusBadgeClass(status?: BusinessTripStatus | string): string {
    if (!status) return this.STATUS_BADGE_CLASS[BusinessTripStatus.None];
    return this.STATUS_BADGE_CLASS[status as BusinessTripStatus] || this.STATUS_BADGE_CLASS[BusinessTripStatus.None];
  }

  getStatusLabel(status?: BusinessTripStatus | string): string {
    if (!status) return this.STATUS_LABEL[BusinessTripStatus.None];
    return this.STATUS_LABEL[status as BusinessTripStatus] || this.STATUS_LABEL[BusinessTripStatus.None];
  }

  private isInitialLoad = true;
  private wasDepartmentSelected = false;
  private wasUnitSelected = false;
  form: FormGroup = this.fb.group({
    unitId: [null],
    departmentId: [null],
    dateFrom: [this.getFirstDayOfCurrentMonth()],
    dateTo: [this.getLastDayOfCurrentMonth()],
  });

  ngOnInit() {
    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
        this.request.update(req => ({
          ...req,
          searchPattern: searchPattern
        }));

        this.getBusinessTrips();
      });

    this.getUnitsByRoles();
  }

  getBusinessTrips(): void {
    this.request.update(req => ({
      ...req,
      startDate: this.form.value.dateFrom,
      endDate: this.form.value.dateTo,
      departmentId: this.form.value.departmentId,
    }))

    this.businessTripService.getFiltered(this.request())
      .subscribe(val => this.businessTrips.set(val));
  }

  private getUnitsByRoles() {
    this.unitService.getUnitsByRoles()
      .pipe(
        catchError(_ => {
          return of([] as Unit[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);

        const currentUserUnitId = this.accountService.currentUser()?.employee?.department?.unit?.id;

        if (this.isInitialLoad && currentUserUnitId && units.some(u => u.id === currentUserUnitId)) {

          this.form.get('unitId')?.setValue(currentUserUnitId);

          this.wasUnitSelected = true;

          this.getDepartmentsByRoles(currentUserUnitId);
        } else {
          this.isInitialLoad = false;
        }
      });
  }

  onUnitChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId !== 'null') {
      this.wasDepartmentSelected = false;
      this.getDepartmentsByRoles(Number(unitId));
    }

    this.departments.set([]);
    this.form.get('departmentId')?.setValue(null);

    this.businessTrips.set([]);
    this.wasUnitSelected = true;
  }

  private getDepartmentsByRoles(unitId: number) {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(
        catchError(_ => {
          return of([] as Department[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);

        const currentUserDepartmentId = this.accountService.currentUser()?.employee?.departmentId;

        if (this.isInitialLoad && currentUserDepartmentId && departments.some(d => d.id === currentUserDepartmentId)) {
          this.form.get('departmentId')?.setValue(currentUserDepartmentId);

          this.request.update(req => ({
            ...req,
            departmentId: currentUserDepartmentId
          }));

          this.wasDepartmentSelected = true;

          this.getBusinessTrips();
        }

        this.isInitialLoad = false;
      });
  }

  onDepartmentChange(event: Event) {
    if (!this.request)
      return;

    const selectElement = event.target as HTMLSelectElement;
    const departmentId = selectElement.value;

    if (departmentId == 'null') {
      this.request.update(req => ({
        ...req,
        departmentId: 0
      }));

      this.businessTrips.set([]);
    }
    else {
      this.request.update(req => ({
        ...req,
        departmentId: Number(departmentId)
      }));

      this.getBusinessTrips();
    }

    this.wasDepartmentSelected = true;
  }

  onSearchChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onDateChange(event: Event): void {
    this.getBusinessTrips();
  }

  getTripDays(startDate: Date, endDate: Date): number {
    return moment(endDate).diff(moment(startDate), 'days') + 1;
  }

  private getFirstDayOfCurrentMonth(): string {
    return moment().startOf('month').format('YYYY-MM-DD');
  }

  private getLastDayOfCurrentMonth(): string {
    return moment().endOf('month').format('YYYY-MM-DD');
  }

  openCreateBusinessTripModal() {
    const ref = this.modalService.show(
      CreateBusinessTripModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {}
      }
    );

    ref.onHidden?.subscribe({
      next: () => this.getBusinessTrips()
    })
  }

  openEditBusinessTripModal(businessTrip: BusinessTrip) {
    const ref = this.modalService.show(
      EditBusinessTripModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          businessTrip: businessTrip,
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getBusinessTrips()
    })
  }

  openDeleteConfirmation(businessTrip: BusinessTrip) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          entityName: `відрядження з маршрутом ${businessTrip.locations[0].name} -> ${businessTrip.locations[businessTrip.locations.length - 1].name}`,
          onConfirm: () => this.deleteBusinessTrip(businessTrip.id)
        }
      });
  }

  deleteBusinessTrip(id: number){
    this.businessTripService.delete(id).pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        this.getBusinessTrips();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
