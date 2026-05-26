import {Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subject, debounceTime, distinctUntilChanged, takeUntil} from 'rxjs';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {BusinessTrip} from '../../models/business-trip.model';
import {BusinessTripService} from '../../services/business-trip.service';
import {LocationService} from '../../services/location.service';
import {Location} from '../../models/location.model';
import {EmployeesService} from '../../../../organization/employees/services/employees.service';
import {Employee} from '../../../../organization/employees/models/employee.model';
import {AccountService} from '../../../../../core/account/services/account.service';
import {DefaultRolesCatalog} from '../../../../../core/account/constants/default-roles-catalog.constants';

@Component({
  selector: 'app-edit-business-trip-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe
  ],
  templateUrl: './edit-business-trip-modal.component.html',
  styleUrl: './edit-business-trip-modal.component.scss'
})
export class EditBusinessTripModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private readonly businessTripService = inject(BusinessTripService);
  private readonly locationService = inject(LocationService);
  private readonly employeesService = inject(EmployeesService);
  private readonly accountService = inject(AccountService);
  bsModalRef = inject(BsModalRef);
  fb = inject(FormBuilder);

  @ViewChild('employeeSearchInput') employeeSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('locationSearchInput') locationSearchInputRef?: ElementRef<HTMLInputElement>;

  businessTrip?: BusinessTrip;

  form: FormGroup = this.fb.group({
    startDate: [null, [Validators.required]],
    endDate: [null, [Validators.required]],
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

  ngOnInit(): void {
    if (this.businessTrip) {
      this.form.patchValue({
        startDate: this.formatDate(this.businessTrip.startDate),
        endDate: this.formatDate(this.businessTrip.endDate),
        description: this.businessTrip.description,
        estimatedBudget: this.businessTrip.estimatedBudget
      });

      if (this.businessTrip.participants) {
        this.selectedEmployees.set([...this.businessTrip.participants]);
      }

      if (this.businessTrip.locations) {
        this.selectedLocations.set(this.businessTrip.locations.map(l => ({
          integrationId: l.locationIntegrationId,
          name: l.name,
          displayName: l.displayName,
          country: l.country,
          countryCode: l.countryCode
        })));
      }
    }

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

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  getDurationDays(): number {
    const start = this.form.value.startDate;
    const end = this.form.value.endDate;

    if (!start || !end)
      return 0;

    const diff = new Date(end).getTime() - new Date(start).getTime();

    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }

  getInitials(employee: Employee): string {
    const parts = employee.fullName?.split(' ') ?? [];

    if (parts.length >= 2)
      return (parts[0][0] + parts[1][0]).toUpperCase();

    return employee.fullName?.substring(0, 2).toUpperCase() ?? '??';
  }

  // Employee search
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

  // Location search
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
    if (!this.isFormValid || !this.businessTrip) return;

    const value = this.form.value;
    const request = {
      id: this.businessTrip.id,
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      description: value.description,
      estimatedBudget: value.estimatedBudget,
      employeeIds: this.selectedEmployees().map(e => e.id),
      locationIntegrationIds: this.selectedLocations().map(l => l.integrationId)
    };

    this.businessTripService.update(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        },
        error: () => {}
      });
  }

  get canApproveOrReject(): boolean {
    const roles = this.accountService.currentUser()?.roles ?? [];
    return roles.includes(DefaultRolesCatalog.SYS_ADMIN) || roles.includes(DefaultRolesCatalog.UNIT_DIRECTOR);
  }

  approve(): void {
    if (!this.businessTrip) return;

    this.businessTripService.approveBusinessTrip(this.businessTrip.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.bsModalRef.hide(),
        error: () => {}
      });
  }

  reject(): void {
    if (!this.businessTrip) return;

    this.businessTripService.rejectBusinessTrip(this.businessTrip.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.bsModalRef.hide(),
        error: () => {}
      });
  }
}
