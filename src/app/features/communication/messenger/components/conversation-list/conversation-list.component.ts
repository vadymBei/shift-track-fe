import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap} from 'rxjs';
import {Button} from 'primeng/button';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Skeleton} from 'primeng/skeleton';
import {Tooltip} from 'primeng/tooltip';
import {MessengerStore} from '../../services/messenger.store';
import {MessengerApiService} from '../../services/messenger-api.service';
import {ChatContact, Conversation} from '../../models/messenger.models';
import {ChatAvatarComponent} from '../chat-avatar/chat-avatar.component';
import {conversationTitle, listTime, previewText, typingLabel, firstName} from '../../utils/messenger-format';

type ListFilter = 'all' | 'unread' | 'groups';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, IconField, InputIcon, InputText, Skeleton, Tooltip, ChatAvatarComponent],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss'
})
export class ConversationListComponent implements OnInit {
  private readonly store = inject(MessengerStore);
  private readonly api = inject(MessengerApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeId = input<number | null>(null);

  readonly newChat = output<void>();
  readonly openContact = output<ChatContact>();

  readonly filter = signal<ListFilter>('all');
  readonly search = signal('');
  readonly people = signal<ChatContact[]>([]);
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  readonly loading = computed(() => !this.store.conversationsLoaded());
  readonly unreadConversations = computed(() => this.store.conversations().filter(x => x.unreadCount > 0).length);

  readonly visible = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('uk');
    const filter = this.filter();
    return this.store.conversations().filter(x =>
      (filter !== 'unread' || x.unreadCount > 0)
      && (filter !== 'groups' || x.type === 'Group')
      && (!term || conversationTitle(x).toLocaleLowerCase('uk').includes(term)));
  });

  /** People found by the search who don't have a direct chat in the list yet. */
  readonly newPeople = computed(() => {
    const withChat = new Set(this.store.conversations()
      .filter(x => x.type === 'Direct' && x.interlocutor)
      .map(x => x.interlocutor!.employeeId));
    return this.people().filter(x => !withChat.has(x.employeeId));
  });

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => term.length < 2
        ? of([] as ChatContact[])
        : this.api.searchContacts(term).pipe(catchError(() => of([] as ChatContact[])))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(people => this.people.set(people));
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value.trim());
  }

  clearSearch(): void {
    this.onSearch('');
  }

  title(conversation: Conversation): string {
    return conversationTitle(conversation);
  }

  time(conversation: Conversation): string {
    return listTime(conversation.lastActivityAt);
  }

  preview(conversation: Conversation): string {
    const typing = (this.store.typing()[conversation.id] ?? []).map(x => firstName(x.fullName));
    return typing.length ? typingLabel(typing) : previewText(conversation, this.store.me());
  }

  isTyping(conversation: Conversation): boolean {
    return !!this.store.typing()[conversation.id]?.length;
  }

  avatarSeed(conversation: Conversation): number {
    return conversation.type === 'Direct' ? conversation.interlocutor?.employeeId ?? 0 : conversation.id;
  }

  unreadLabel(conversation: Conversation): string {
    return conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount);
  }

  subtitle(contact: ChatContact): string {
    return [contact.positionName, contact.departmentName ?? contact.unitName].filter(Boolean).join(' · ');
  }
}
