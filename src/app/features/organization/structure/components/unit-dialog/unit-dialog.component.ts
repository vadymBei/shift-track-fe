import {Component, inject, OnDestroy, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, Subject, takeUntil} from 'rxjs';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {InputText} from 'primeng/inputtext';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {UnitService} from '../../services/unit.service';
import {Unit} from '../../models/unit.model';

export interface UnitDialogData {
  unit?: Unit;
}

@Component({
  selector: 'app-unit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, Textarea, Button, Message],
  templateUrl: './unit-dialog.component.html'
})
export class UnitDialogComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly unitService = inject(UnitService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly unit = inject<DynamicDialogConfig<UnitDialogData>>(DynamicDialogConfig).data?.unit;
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    code: [this.unit?.code ?? '', [Validators.required, Validators.maxLength(10)]],
    name: [this.unit?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    description: [this.unit?.description ?? '', [Validators.required, Validators.maxLength(100)]]
  });

  isInvalid(name: 'code' | 'name' | 'description'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {code, name, description} = this.form.getRawValue();
    const body = {code: code!.trim(), name: name!.trim(), description: description!.trim()};
    const request$ = this.unit
      ? this.unitService.updateUnit({id: this.unit.id, ...body})
      : this.unitService.createUnit(body);

    this.isSaving.set(true);
    request$
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(this.unit ? 'Регіон оновлено' : 'Регіон додано');
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
