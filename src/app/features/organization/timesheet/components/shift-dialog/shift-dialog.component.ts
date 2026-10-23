import {Component, computed, inject, OnDestroy, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, startWith, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {InputText} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {ColorPicker} from 'primeng/colorpicker';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {Tooltip} from 'primeng/tooltip';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {TimeFormatService} from '../../../../../shared/services/time-format.service';
import {ShiftsService} from '../../services/shifts.service';
import {Shift} from '../../models/shift.model';
import {ShiftType} from '../../enums/shift-type.enum';
import {formatDuration, readableTextColor, SHIFT_COLORS, SHIFT_TYPE_OPTIONS, shiftMinutes} from '../../constants/shift-labels';

export interface ShiftDialogData {
  shift?: Shift;
}

@Component({
  selector: 'app-shift-dialog',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, PrimeTemplate, InputText, Select, DatePicker, ColorPicker, Button, Message, Tooltip
  ],
  templateUrl: './shift-dialog.component.html',
  styleUrl: './shift-dialog.component.scss'
})
export class ShiftDialogComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly shiftsService = inject(ShiftsService);
  private readonly timeFormat = inject(TimeFormatService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly shift = inject<DynamicDialogConfig<ShiftDialogData>>(DynamicDialogConfig).data?.shift;
  readonly typeOptions = SHIFT_TYPE_OPTIONS;
  readonly colors = SHIFT_COLORS;
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    code: [this.shift?.code ?? '', [Validators.required, Validators.maxLength(10)]],
    type: this.fb.control<ShiftType | null>(this.shift?.type ?? ShiftType.workday, Validators.required),
    startTime: this.fb.control<Date | null>(this.timeFormat.fromTimeSpanFormat(this.shift?.startTime)),
    endTime: this.fb.control<Date | null>(this.timeFormat.fromTimeSpanFormat(this.shift?.endTime)),
    description: [this.shift?.description ?? '', [Validators.required, Validators.maxLength(100)]],
    color: [this.shift?.color || SHIFT_COLORS[5], [Validators.required]]
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue()
  });

  readonly isWorkday = computed(() => this.value().type === ShiftType.workday);
  readonly previewCode = computed(() => this.value().code?.trim() || 'КОД');
  readonly previewColor = computed(() => this.value().color || '#FFFFFF');
  readonly previewTextColor = computed(() => readableTextColor(this.value().color));

  readonly duration = computed(() => {
    const {startTime, endTime} = this.value();
    const minutes = shiftMinutes(this.timeFormat.toTimeSpanFormat(startTime ?? null), this.timeFormat.toTimeSpanFormat(endTime ?? null));
    return minutes === null ? null : {text: formatDuration(minutes), overnight: !!startTime && !!endTime && endTime <= startTime};
  });

  constructor() {
    this.form.controls.type.valueChanges.pipe(startWith(this.form.controls.type.value), takeUntil(this.destroy$))
      .subscribe(type => {
        const validators = type === ShiftType.workday ? [Validators.required] : [];
        this.form.controls.startTime.setValidators(validators);
        this.form.controls.endTime.setValidators(validators);
        this.form.controls.startTime.updateValueAndValidity({emitEvent: false});
        this.form.controls.endTime.updateValueAndValidity({emitEvent: false});
      });
  }

  onCustomColor(value: string): void {
    const hex = value.startsWith('#') ? value : `#${value}`;
    this.form.controls.color.setValue(hex.toUpperCase());
    this.form.markAsDirty();
  }

  pickColor(color: string): void {
    this.form.controls.color.setValue(color);
    this.form.markAsDirty();
  }

  isInvalid(name: 'code' | 'description' | 'startTime' | 'endTime'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const workday = value.type === ShiftType.workday;
    const body = {
      code: value.code!.trim(),
      description: value.description!.trim(),
      color: value.color!,
      type: value.type!,
      startTime: workday ? this.timeFormat.toTimeSpanFormat(value.startTime) : null,
      endTime: workday ? this.timeFormat.toTimeSpanFormat(value.endTime) : null
    };

    const request$ = this.shift
      ? this.shiftsService.updateShift({id: this.shift.id, ...body})
      : this.shiftsService.createShift(body);

    this.isSaving.set(true);
    request$
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(this.shift ? 'Зміну оновлено' : 'Зміну додано');
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
