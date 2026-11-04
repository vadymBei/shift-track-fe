import {ChangeDetectorRef, computed, Directive, effect, inject, input, OnInit, untracked} from '@angular/core';
import {Avatar} from 'primeng/avatar';
import {EmployeePhotosService} from '../services/employee-photos.service';

/**
 * The photo of the employee in a p-avatar, the initials until it loads or without one:
 * <p-avatar [appPersonAvatar]="employee.id" [initials]="initials(employee)" shape="circle" styleClass="app-avatar"/>
 */
@Directive({
  selector: 'p-avatar[appPersonAvatar]',
  standalone: true,
  host: {'[class.has-photo]': '!!photo()'}
})
export class PersonAvatarDirective implements OnInit {
  readonly employeeId = input<number | null | undefined>(null, {alias: 'appPersonAvatar'});
  readonly initials = input<string | null | undefined>('');

  private readonly avatar = inject(Avatar);
  /** Of the avatar: a directive on a component host gets the component's. */
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly photos = inject(EmployeePhotosService);

  readonly photo = computed(() => this.photos.photo(this.employeeId())());

  constructor() {
    effect(() => {
      this.photo();
      this.initials();
      untracked(() => this.apply());
    });
  }

  ngOnInit(): void {
    // Before the avatar is rendered for the first time.
    this.apply();
  }

  private apply(): void {
    const photo = this.photo();
    this.avatar.image = photo ?? undefined;
    this.avatar.label = photo ? undefined : (this.initials() || undefined);
    this.changeDetector.markForCheck();
  }
}
