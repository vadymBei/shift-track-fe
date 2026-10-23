import {Component, inject, OnDestroy, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, Subject, takeUntil} from 'rxjs';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {InputText} from 'primeng/inputtext';
import {InputNumber} from 'primeng/inputnumber';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {PositionService} from '../../services/position.service';
import {Position} from '../../models/position.model';

export interface PositionDialogData {
  position?: Position;
}

@Component({
  selector: 'app-position-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, InputNumber, Textarea, Button, Message],
  templateUrl: './position-dialog.component.html'
})
export class PositionDialogComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly positionService = inject(PositionService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly position = inject<DynamicDialogConfig<PositionDialogData>>(DynamicDialogConfig).data?.position;
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    name: [this.position?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    hourlyRate: this.fb.control<number | null>(this.position?.hourlyRate ?? null, [Validators.required, Validators.min(0), Validators.max(1000)]),
    description: [this.position?.description ?? '', [Validators.required, Validators.maxLength(100)]]
  });

  isInvalid(name: 'name' | 'hourlyRate' | 'description'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {name, hourlyRate, description} = this.form.getRawValue();
    const body = {name: name!.trim(), hourlyRate: hourlyRate!, description: description!.trim()};
    const request$ = this.position
      ? this.positionService.updatePosition({id: this.position.id, ...body})
      : this.positionService.createPosition(body);

    this.isSaving.set(true);
    request$
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(this.position ? 'Посаду оновлено' : 'Посаду додано');
        this.ref.close(true);
      });
  }

  close(): void {
    this.ref.close(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
