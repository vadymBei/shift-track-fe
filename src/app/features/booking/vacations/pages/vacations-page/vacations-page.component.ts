import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {DepartmentService} from "../../../../organization/structure/services/department.service";
import {UnitService} from "../../../../organization/structure/services/unit.service";
import {catchError, delay, finalize, of, Subject, takeUntil} from "rxjs";
import {Unit} from "../../../../organization/structure/models/unit.model";
import {Department} from "../../../../organization/structure/models/department.model";
import {debounceTime} from "rxjs/operators";
import {AllVacationsRequest} from "../../models/all-vacations-request.model";
import {Vacation} from "../../models/vacation.model";
import {VacationType} from "../../enums/vacation-type.enum";
import {VacationStatus} from "../../enums/vacation-status.enum";
import {CommonModule} from "@angular/common";
import {BsDatepickerModule} from "ngx-bootstrap/datepicker";
import {TooltipModule} from "ngx-bootstrap/tooltip";
import {BsModalService} from "ngx-bootstrap/modal";
import {EditVacationModalComponent} from "../../components/edit-vacation-modal/edit-vacation-modal.component";
import {CreateVacationModalComponent} from "../../components/create-vacation-modal/create-vacation-modal.component";
import {VacationService} from "../../services/vacation.service";
import {
  DeleteConfirmationModalComponent
} from "../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component";
import moment from "moment";

@Component({
  selector: 'app-vacations-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BsDatepickerModule,
    TooltipModule,
    BsDatepickerModule
  ],
  templateUrl: './vacations-page.component.html',
  styleUrl: './vacations-page.component.scss'
})
export class VacationsPageComponent implements OnInit, OnDestroy {
  private readonly departmentService = inject(DepartmentService);
  private readonly vacationService = inject(VacationService);
  private readonly unitService = inject(UnitService);
  private readonly fb = inject(FormBuilder);
  private readonly modalService = inject(BsModalService);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  protected readonly VacationStatus = VacationStatus;

  wasDepartmentSelected = false;
  wasUnitSelected = false;
  form: FormGroup = this.fb.group({
    searchPattern: [''],
    unitId: [null],
    departmentId: [null],
    dateFrom: [this.getFirstDayOfCurrentMonth()],
    dateTo: [this.getLastDayOfCurrentMonth()],
    vacationStatus: [VacationStatus.None]
  });

  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal(false);
  vacations = signal<Vacation[]>([]);
  request = signal<AllVacationsRequest>({
    searchPattern: '',
    unitId: undefined,
    departmentId: undefined,
    vacationStatus: VacationStatus.None,
    startDate: new Date(),
    endDate: new Date()
  });

  // map vacation status to bootstrap border color classes
  private readonly STATUS_BORDER_CLASS: Record<VacationStatus | string, string> = {
    [VacationStatus.ApprovedByDepartmentDirector]: 'border-success',
    [VacationStatus.ApprovedByUnitDirector]: 'border-success',
    [VacationStatus.PendingApproval]: 'border-warning',
    [VacationStatus.Rejected]: 'border-danger',
    [VacationStatus.None]: 'border-secondary'
  };

  getStatusBorderClass(status?: VacationStatus | string): string {
    if (!status) return this.STATUS_BORDER_CLASS[VacationStatus.None];
    return this.STATUS_BORDER_CLASS[status as VacationStatus] || this.STATUS_BORDER_CLASS[VacationStatus.None];
  }

  // map vacation status to bootstrap badge classes and labels (ukr)
  private readonly STATUS_BADGE_CLASS: Record<VacationStatus | string, string> = {
    [VacationStatus.ApprovedByDepartmentDirector]: 'text-success bg-success-subtle',
    [VacationStatus.ApprovedByUnitDirector]: 'text-success bg-success-subtle',
    [VacationStatus.PendingApproval]: 'text-warning bg-warning-subtle',
    [VacationStatus.Rejected]: 'text-danger bg-danger-subtle',
    [VacationStatus.None]: 'text-secondary bg-secondary-subtle'
  };

  private readonly STATUS_LABEL: Record<VacationStatus | string, string> = {
    [VacationStatus.ApprovedByDepartmentDirector]: 'Затверджено',
    [VacationStatus.ApprovedByUnitDirector]: 'Затверджено',
    [VacationStatus.PendingApproval]: 'Очікує',
    [VacationStatus.Rejected]: 'Відхилено',
    [VacationStatus.None]: 'Невідомо'
  };

  getStatusBadgeClass(status?: VacationStatus | string): string {
    if (!status) return this.STATUS_BADGE_CLASS[VacationStatus.None];
    return this.STATUS_BADGE_CLASS[status as VacationStatus] || this.STATUS_BADGE_CLASS[VacationStatus.None];
  }

  getStatusLabel(status?: VacationStatus | string): string {
    if (!status) return this.STATUS_LABEL[VacationStatus.None];
    return this.STATUS_LABEL[status as VacationStatus] || this.STATUS_LABEL[VacationStatus.None];
  }

  ngOnInit(): void {
    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
        this.getVacations();
      });

    this.getUnitsByRoles();
  }

  getVacations() {
    if (this.form.value.unitId === null
      || this.form.value.departmentId === null) {
      this.vacations.set([]);
      return;
    }

    this.request.update(req => ({
      ...req,
      unitId: this.form.value.unitId,
      departmentId: this.form.value.departmentId,
      searchPattern: this.form.value.searchPattern,
      vacationStatus: this.form.value.vacationStatus,
      startDate: this.form.value.dateFrom,
      endDate: this.form.value.dateTo,
    }))

    this.isLoading.set(true);

    this.vacationService.getVacations(this.request())
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(val => {
        this.vacations.set(val);
      });
  }

  getUnitsByRoles(): void {
    this.unitService.getUnitsByRoles()
      .pipe(
        catchError(error => {
          return of([] as Unit[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);
      });
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId !== 'null') {
      this.wasDepartmentSelected = false;
      this.getDepartmentsByRoles(Number(unitId));
    }

    this.vacations.set([]);
    this.departments.set([]);
    this.form.get('departmentId')?.setValue(null);

    this.wasUnitSelected = true;
  }

  getDepartmentsByRoles(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(
        catchError(error => {
          return of([] as Department[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);
      });
  }

  onDepartmentChange(event: Event): void {
    this.getVacations();

    this.wasDepartmentSelected = true;
  }

  onDateChange(event: Event): void {
    this.getVacations();
  }

  private getFirstDayOfCurrentMonth(): string {
    return moment().startOf('month').format('YYYY-MM-DD');
  }

  private getLastDayOfCurrentMonth(): string {
    return moment().endOf('month').format('YYYY-MM-DD');
  }

  onSearchChange(event: Event): void {
    this.getVacations();
  }

  onVacationStatusChange(event: Event): void {
    this.getVacations();
  }

  downloadVacationRequest(vacation: Vacation): void {
    this.vacationService.downloadVacationRequest(vacation.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;

          link.download = `Відпустка працівника ${vacation.employee.fullName} ${moment(vacation.startDate).format('DD/MM/YYYY')}-${moment(vacation.endDate).format('DD/MM/YYYY')}.pdf`;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          window.URL.revokeObjectURL(url);
        }
      });
  }

  openEditVacationModal(vacation: Vacation): void {
    const ref = this.modalService.show(
      EditVacationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          vacation: vacation,
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getVacations()
    })
  }

  openCreateVacationModal() {
    const ref = this.modalService.show(
      CreateVacationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {}
      }
    );

    ref.onHidden?.subscribe({
      next: () => this.getVacations()
    })
  }

  openDeleteConfirmation(vacation: Vacation) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: vacation.employee.fullName,
          entityName: 'відпустку для працівника',
          onConfirm: () => this.deleteVacation(vacation.id)
        }
      });
  }

  deleteVacation(vacationId: number) {
    this.vacationService.deleteVacation(vacationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        this.getVacations();
      })
  }

  getVacationTypeString(type: VacationType): string {
    switch (type) {
      case VacationType.YearMainVacation:
        return 'Основна щорічна відпустка';
      case VacationType.BonusVacation:
        return 'Бонусна відпустка';
      case VacationType.VacationWithoutSalaryByFamily:
        return 'Відпустка без збереження з/п за згодою сторін за сімейними обставинами';
      case VacationType.VacationWithoutSalaryByPregnancy:
        return 'Відпустка у зв\'язку з вагітністю та пологами';
      case VacationType.VacationWithoutSalaryByChild3years:
        return 'Відпустка для догляду за дитиною до досягнення нею 3-го віку';
      case VacationType.VacationWithoutSalaryByChild6years:
        return 'Відпустка для догляду за дитиною до досягнення нею 6-го віку';
      default:
        return 'Відпустка';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
