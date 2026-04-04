import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {UnitService} from '../../../services/unit.service';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {CreatePositionRequest} from '../../../models/create-position-request.model';
import {PositionService} from '../../../services/position.service';
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-create-position-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './create-position-modal.component.html',
  styleUrl: './create-position-modal.component.scss'
})
export class CreatePositionModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly positionService = inject(PositionService);

  bsModalRef = inject(BsModalRef);

  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ],
    hourlyRate: [
      '',
      [
        Validators.required,
        Validators.min(0),
        Validators.max(1000)
      ]
    ],
    description: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ]
  });

  request = signal<CreatePositionRequest>(
    {
      name: '',
      description: '',
      hourlyRate: 0
    }
  );

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createPosition() {
    if (!this.request)
      return;

    this.request.update(value => ({
      ...value,
      name: this.form.value.name,
      description: this.form.value.description,
      hourlyRate: this.form.value.hourlyRate
    }));

    this.positionService.createPosition(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (position) => {
          this.bsModalRef.hide();
        },
        error: error => {
          console.error('creating unit error', error);
        }
      });
  }
}
