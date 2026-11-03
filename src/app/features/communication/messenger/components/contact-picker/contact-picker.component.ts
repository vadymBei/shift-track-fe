import {ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, tap} from 'rxjs';
import {AutoFocus} from 'primeng/autofocus';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {ProgressSpinner} from 'primeng/progressspinner';
import {MessengerApiService} from '../../services/messenger-api.service';
import {ChatContact} from '../../models/messenger.models';
import {ChatAvatarComponent} from '../chat-avatar/chat-avatar.component';

/** Search of employees in the whole company. With "multiple" the results have checkboxes. */
@Component({
  selector: 'app-contact-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AutoFocus, IconField, InputIcon, InputText, ProgressSpinner, ChatAvatarComponent],
  templateUrl: './contact-picker.component.html',
  styleUrl: './contact-picker.component.scss'
})
export class ContactPickerComponent implements OnInit {
  private readonly api = inject(MessengerApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly multiple = input(false);
  /** Ids shown as chosen (multiple). */
  readonly selectedIds = input<number[]>([]);
  /** Ids that can't be chosen, like the members of the group. */
  readonly disabledIds = input<number[]>([]);
  readonly disabledHint = input('Уже в групі');
  readonly autofocus = input(true);

  readonly picked = output<ChatContact>();

  readonly search = signal('');
  readonly results = signal<ChatContact[]>([]);
  readonly loading = signal(false);
  readonly searched = signal(false);

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(term => {
        this.loading.set(term.length >= 2);
        if (term.length < 2) {
          this.results.set([]);
          this.searched.set(false);
        }
      }),
      switchMap(term => term.length < 2
        ? of(null)
        : this.api.searchContacts(term).pipe(catchError(() => of([] as ChatContact[])))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => {
      if (results) {
        this.results.set(results);
        this.searched.set(true);
      }
      this.loading.set(false);
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value.trim());
  }

  isSelected(contact: ChatContact): boolean {
    return this.selectedIds().includes(contact.employeeId);
  }

  isDisabled(contact: ChatContact): boolean {
    return this.disabledIds().includes(contact.employeeId);
  }

  subtitle(contact: ChatContact): string {
    return [contact.positionName, contact.departmentName ?? contact.unitName].filter(Boolean).join(' · ');
  }
}
