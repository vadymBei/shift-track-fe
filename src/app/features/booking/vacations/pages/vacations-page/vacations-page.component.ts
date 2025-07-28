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

  form: FormGroup = this.fb.group({
    searchPattern: [''],
    unitId: [null],
    departmentId: [null],
    dateFrom: [this.getFirstDayOfCurrentMonth()],
    dateTo: [this.getLastDayOfCurrentMonth()],
    vacationStatus: [VacationStatus.None]
  });

  request = signal<AllVacationsRequest>({
    searchPattern: '',
    unitId: undefined,
    departmentId: undefined,
    vacationStatus: VacationStatus.None,
    startDate: new Date(),
    endDate: new Date()
  });

  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal(false);
  vacations = signal<Vacation[]>([]);

  ngOnInit(): void {
    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
        this.getVacations();
      });

    this.getUnits();
  }

  private getFirstDayOfCurrentMonth(): string {
    return moment().startOf('month').format('YYYY-MM-DD');
  }

  private getLastDayOfCurrentMonth(): string {
    return moment().endOf('month').format('YYYY-MM-DD');
  }

  getUnits(): void {
    this.unitService.getUnits()
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

  onSearchChange(event: Event): void {
    this.getVacations();
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId === 'null') {
      this.departments.set([]);

      this.form.get('departmentId')?.setValue(null);
    } else {
      const numericUnitId = Number(unitId);

      this.getDepartmentsByUnitId(numericUnitId);
    }

    this.vacations.set([]);
  }

  onDepartmentChange(event: Event): void {
    this.getVacations();
  }

  onVacationStatusChange(event: Event): void {
    this.getVacations();
  }

  getDepartmentsByUnitId(unitId: number): void {
    this.departmentService.getDepartmentsByUnitId(unitId)
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

  getStatusClass(status: VacationStatus): string {
    switch (status) {
      case VacationStatus.ApprovedByUnitDirector:
        return 'status-approved';
      case VacationStatus.Rejected:
        return 'status-rejected';
      default:
        return '';
    }
  }

  getVacationStatusString(status: VacationStatus): string {
    switch (status) {
      case VacationStatus.ApprovedByUnitDirector:
        return 'Погоджено регіональним директором';
      case VacationStatus.ApprovedByDepartmentDirector:
        return 'Погоджено директором';
      case VacationStatus.PendingApproval:
        return 'Очікує затвердження';
      case VacationStatus.Rejected:
        return 'Відхилено';
      default:
        return '';
    }
  }

  openEditVacationModal(vacation: Vacation): void {
    const ref = this.modalService.show(
      EditVacationModalComponent,
      {
        class: 'modal modal-dialog-centered',
        initialState: {
          vacation: vacation,
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getVacations()
    })
  }

  getVacations() {
    if (this.form.value.unitId === undefined
      || this.form.value.departmentId === undefined) {
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

  onDateChange(event: Event): void {
    this.getVacations();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
