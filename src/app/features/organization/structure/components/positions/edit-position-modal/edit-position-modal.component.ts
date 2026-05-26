import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {PositionService} from '../../../services/position.service';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {EditPositionRequest} from '../../../models/edit-position-request.model';
import {Position} from '../../../models/position.model';
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-edit-position-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './edit-position-modal.component.html',
  styleUrl: './edit-position-modal.component.scss'
})
export class EditPositionModalComponent implements OnInit, OnDestroy {
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

  request = signal<EditPositionRequest>(
    {
      id: 0,
      name: '',
      description: '',
      hourlyRate: 0
    }
  );

  position?: Position;

  ngOnInit(): void {
    this.getPositionById();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getPositionById() {
    this.positionService.getPositionById(this.position!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(position => this.updateFormWithPositionData(position));
  }

  updateFormWithPositionData(position: Position) {
    this.form.patchValue({
      name: position.name,
      description: position.description,
      hourlyRate: position.hourlyRate
    });
  }

  updatePosition() {
    if (!this.request)
      return;

    this.request.update(value => ({
      ...value,
      id: this.position!.id,
      name: this.form.value.name,
      description: this.form.value.description,
      hourlyRate: this.form.value.hourlyRate
    }));

    this.positionService.updatePosition(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: position => {
          this.bsModalRef.hide();
        },
        error: error => {
          console.error('updating position error', error);
        }
      })
  }
}
