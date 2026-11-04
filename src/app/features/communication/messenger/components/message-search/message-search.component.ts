import {AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap} from 'rxjs';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Tooltip} from 'primeng/tooltip';
import {MessengerApiService} from '../../services/messenger-api.service';
import {MessageSearch} from '../../models/messenger.models';

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;
const DEBOUNCE_MS = 300;

type State =
  | {kind: 'idle'}
  | {kind: 'loading'}
  | {kind: 'failed'}
  | {kind: 'done'; query: string; result: MessageSearch};

/**
 * Search in the open conversation: the matches from the newest, ↑ to older ones, ↓ back.
 * Enter is the next older match, Shift+Enter the newer one, Escape closes.
 */
@Component({
  selector: 'app-message-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, InputText, Tooltip],
  template: `
    <div class="search" role="search" aria-label="Пошук у чаті">
      <span class="field">
        <i class="pi pi-search" aria-hidden="true"></i>
        <input #input pInputText type="text" class="input" placeholder="Пошук у чаті" aria-label="Пошук у чаті"
               [maxlength]="maxLength" autocomplete="off" enterkeyhint="search"
               [ngModel]="query()" (ngModelChange)="onQuery($event)" (keydown)="onKeydown($event)"/>
      </span>
      <span class="status tabular" aria-live="polite">{{ status() }}</span>
      <p-button icon="pi pi-chevron-up" [rounded]="true" [text]="true" severity="secondary"
                ariaLabel="Попередній збіг" pTooltip="Попередній збіг" tooltipPosition="bottom"
                [disabled]="!canOlder()" (onClick)="older()"/>
      <p-button icon="pi pi-chevron-down" [rounded]="true" [text]="true" severity="secondary"
                ariaLabel="Наступний збіг" pTooltip="Наступний збіг" tooltipPosition="bottom"
                [disabled]="!canNewer()" (onClick)="newer()"/>
      <p-button icon="pi pi-times" [rounded]="true" [text]="true" severity="secondary"
                ariaLabel="Закрити пошук" (onClick)="closed.emit()"/>
    </div>
  `,
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--p-content-border-color);
    }

    .field {
      position: relative;
      display: flex;
      flex: 1;
      min-width: 0;

      i {
        position: absolute;
        top: 50%;
        left: 12px;
        transform: translateY(-50%);
        color: var(--p-text-muted-color);
        font-size: 14px;
        pointer-events: none;
      }
    }

    .input {
      width: 100%;
      padding-left: 36px;
      border-radius: 999px;
    }

    .status {
      flex-shrink: 0;
      min-width: 4.5em;
      padding: 0 4px;
      color: var(--p-text-muted-color);
      font-size: 13px;
      text-align: center;
      white-space: nowrap;
    }
  `
})
export class MessageSearchComponent implements AfterViewInit {
  private readonly api = inject(MessengerApiService);

  readonly conversationId = input.required<number>();
  /** The message to show: loaded, scrolled to and marked by the conversation. */
  readonly jump = output<number>();
  /** The text to mark in the messages, '' for none. */
  readonly highlight = output<string>();
  readonly closed = output<void>();

  readonly maxLength = MAX_LENGTH;
  readonly query = signal('');
  readonly state = signal<State>({kind: 'idle'});
  /** In the matches, 0 is the newest. */
  readonly index = signal(0);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly queries = new Subject<string>();

  readonly matches = computed(() => {
    const state = this.state();
    return state.kind === 'done' ? state.result.messageIds : [];
  });

  readonly status = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'loading':
        return 'Пошук…';
      case 'failed':
        return 'Помилка';
      case 'done': {
        const count = state.result.messageIds.length;
        return count ? `${this.index() + 1} з ${count}${state.result.hasMore ? '+' : ''}` : 'Не знайдено';
      }
      default:
        return '';
    }
  });

  readonly canOlder = computed(() => this.index() < this.matches().length - 1);
  readonly canNewer = computed(() => this.index() > 0);

  constructor() {
    this.queries.pipe(
      map(x => x.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < MIN_LENGTH) {
          return of<State>({kind: 'idle'});
        }
        this.state.set({kind: 'loading'});
        return this.api.searchMessages(this.conversationId(), query).pipe(
          map(result => ({kind: 'done', query, result}) as State),
          catchError(() => of<State>({kind: 'failed'})));
      }),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(state => {
      this.state.set(state);
      this.index.set(0);
      const found = state.kind === 'done' && state.result.messageIds.length > 0;
      this.highlight.emit(found ? state.query : '');
      if (found) {
        this.jump.emit(state.result.messageIds[0]);
      }
    });
  }

  ngAfterViewInit(): void {
    this.input().nativeElement.focus();
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.queries.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        this.newer();
      } else {
        this.older();
      }
    }
  }

  older(): void {
    if (this.canOlder()) {
      this.go(this.index() + 1);
    }
  }

  newer(): void {
    if (this.canNewer()) {
      this.go(this.index() - 1);
    }
  }

  private go(index: number): void {
    this.index.set(index);
    this.jump.emit(this.matches()[index]);
  }
}
