import {Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {CommonModule, DatePipe} from "@angular/common";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {debounceTime, distinctUntilChanged, Subject, takeUntil} from "rxjs";
import {BusinessTripService} from "../../services/business-trip.service";
import {LocationService} from "../../services/location.service";
import {EmployeesService} from "../../../../organization/employees/services/employees.service";
import {BsModalRef} from "ngx-bootstrap/modal";
import {Employee} from "../../../../organization/employees/models/employee.model";
import {Location} from "../../models/location.model";
import moment from "moment/moment";
import {CreateBusinessTripRequest} from "../../models/create-business-trip-request.model";

@Component({
  selector: 'app-create-business-trip-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe
  ],
  templateUrl: './create-business-trip-modal.component.html',
  styleUrl: './create-business-trip-modal.component.scss'
})
export class CreateBusinessTripModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private readonly businessTripService = inject(BusinessTripService);
  private readonly locationService = inject(LocationService);
  private readonly employeesService = inject(EmployeesService);
  bsModalRef = inject(BsModalRef);
  fb = inject(FormBuilder);

  @ViewChild('employeeSearchInput') employeeSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('locationSearchInput') locationSearchInputRef?: ElementRef<HTMLInputElement>;

  form: FormGroup = this.fb.group({
    startDate: [this.formatDateForInput(new Date()), [Validators.required]],
    endDate: [this.formatDateForInput(new Date()), [Validators.required]],
    description: ['', [Validators.required]],
    estimatedBudget: [null, [Validators.required, Validators.min(0)]]
  });

  employeeSearchPattern = signal('');
  employeeSearchResults = signal<Employee[]>([]);
  selectedEmployees = signal<Employee[]>([]);
  showEmployeeDropdown = signal(false);
  showEmployeeSearch = signal(false);
  employeeSearch$ = new Subject<string>();

  locationSearchPattern = signal('');
  locationSearchResults = signal<Location[]>([]);
  selectedLocations = signal<Location[]>([]);
  showLocationDropdown = signal(false);
  showLocationSearch = signal(false);
  locationSearch$ = new Subject<string>();

  request = signal<CreateBusinessTripRequest>({
    startDate: new Date(),
    endDate: new Date(),
    description: '',
    estimatedBudget: 0,
    employeeIds: [],
    locationIntegrationIds: []
  })

  ngOnInit(): void {
    this.employeeSearch$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(pattern => {
      if (pattern.trim().length > 0) {
        this.employeesService.getAllEmployees({searchPattern: pattern})
          .pipe(takeUntil(this.destroy$))
          .subscribe(employees => {
            this.employeeSearchResults.set(employees);
          });
      } else {
        this.employeeSearchResults.set([]);
      }
    });

    this.locationSearch$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(pattern => {
      if (pattern.trim().length > 0) {
        this.locationService.searchLocations(pattern)
          .pipe(takeUntil(this.destroy$))
          .subscribe(locations => {
            this.locationSearchResults.set(locations);
          });
      } else {
        this.locationSearchResults.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatDateForInput(date: Date): string {
    return moment(date).format('YYYY-MM-DD');
  }

  getDurationDays(): number {
    const startDate = this.form.value.startDate;
    const endDate = this.form.value.endDate;

    if (!startDate || !endDate)
      return 0;

    if(startDate === endDate)
      return 1;

    return moment(endDate).diff(moment(startDate), 'days') + 1;
  }

  getInitials(employee: Employee): string {
    const parts = employee.fullName?.split(' ') ?? [];

    if (parts.length >= 2)
      return (parts[0][0] + parts[1][0]).toUpperCase();

    return employee.fullName?.substring(0, 2).toUpperCase() ?? '??';
  }

  focusEmployeeSearch(): void {
    this.showEmployeeSearch.set(true);

    setTimeout(() => this.employeeSearchInputRef?.nativeElement.focus(), 50);
  }

  onEmployeeSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.employeeSearchPattern.set(value);
    this.showEmployeeDropdown.set(true);
    this.employeeSearch$.next(value);
  }

  onEmployeeSearchBlur(): void {
    setTimeout(() => {
      this.showEmployeeDropdown.set(false);

      if (!this.employeeSearchPattern()) {
        this.showEmployeeSearch.set(false);
      }
    }, 150);
  }

  selectEmployee(employee: Employee): void {
    if (!this.selectedEmployees().find(e => e.id === employee.id)) {
      this.selectedEmployees.update(list => [...list, employee]);
    }
    this.employeeSearchPattern.set('');
    this.employeeSearchResults.set([]);
    this.showEmployeeDropdown.set(false);
    this.showEmployeeSearch.set(false);
  }

  removeEmployee(employee: Employee): void {
    this.selectedEmployees.update(list => list.filter(e => e.id !== employee.id));
  }

  isEmployeeSelected(employee: Employee): boolean {
    return !!this.selectedEmployees().find(e => e.id === employee.id);
  }

  focusLocationSearch(): void {
    this.showLocationSearch.set(true);
    setTimeout(() => this.locationSearchInputRef?.nativeElement.focus(), 50);
  }

  onLocationSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.locationSearchPattern.set(value);
    this.showLocationDropdown.set(true);
    this.locationSearch$.next(value);
  }

  onLocationSearchBlur(): void {
    setTimeout(() => {
      this.showLocationDropdown.set(false);
      if (!this.locationSearchPattern()) {
        this.showLocationSearch.set(false);
      }
    }, 150);
  }

  selectLocation(location: Location): void {
    if (!this.selectedLocations().find(l => l.integrationId === location.integrationId)) {
      this.selectedLocations.update(list => [...list, location]);
    }
    this.locationSearchPattern.set('');
    this.locationSearchResults.set([]);
    this.showLocationDropdown.set(false);
    this.showLocationSearch.set(false);
  }

  removeLocation(location: Location): void {
    this.selectedLocations.update(list => list.filter(l => l.integrationId !== location.integrationId));
  }

  isLocationSelected(location: Location): boolean {
    return !!this.selectedLocations().find(l => l.integrationId === location.integrationId);
  }

  get isFormValid(): boolean {
    return this.form.valid
      && this.selectedEmployees().length >= 1
      && this.selectedLocations().length >= 2;
  }

  save(): void {
    if (!this.isFormValid)
      return;

    const value = this.form.value;

    this.request.set({
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      description: value.description,
      estimatedBudget: value.estimatedBudget,
      employeeIds: this.selectedEmployees().map(e => e.id),
      locationIntegrationIds: this.selectedLocations().map(l => l.integrationId)
    });

    this.businessTripService.create(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        },
        error: () => {
        }
      });
  }
}
