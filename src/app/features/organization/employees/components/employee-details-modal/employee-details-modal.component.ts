import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Employee} from "../../models/employee.model";
import {EmployeeGender} from "../../enums/employee-gender.enum";
import {DatePipe} from "@angular/common";
import {BsModalRef} from "ngx-bootstrap/modal";
import {AccountService} from "../../../../../core/account/services/account.service";
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-employee-details-modal',
  standalone: true,
  imports: [
    DatePipe
  ],
  templateUrl: './employee-details-modal.component.html',
  styleUrl: './employee-details-modal.component.scss'
})
export class EmployeeDetailsModalComponent  implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  bsModalRef = inject(BsModalRef);
  private accountService = inject(AccountService);

  employee?: Employee;
  profilePhotoUrl = signal<string>('/assets/images/profile.png');

  ngOnInit(): void {
    this.getUserPhoto();
  }

  getUserPhoto() {
    this.accountService.getProfilePhoto(this.employee!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.body) {
            const blob = response.body;
            const url = URL.createObjectURL(blob);
            this.profilePhotoUrl.set(url);
          }
        }
      });
  }

  get departmentName(): string {
    return this.employee?.department?.name ?? 'Не вказано';
  }

  get unitName(): string {
    return this.employee?.department?.unit?.name ?? 'Не вказано';
  }

  get positionName(): string {
    return this.employee?.position?.name ?? 'Без посади';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
