import {ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {map} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {Drawer} from 'primeng/drawer';
import {DialogService} from 'primeng/dynamicdialog';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {MessengerStore} from '../../services/messenger.store';
import {ChatContact, Conversation} from '../../models/messenger.models';
import {ConversationListComponent} from '../../components/conversation-list/conversation-list.component';
import {ConversationViewComponent} from '../../components/conversation-view/conversation-view.component';
import {ConversationDetailsComponent} from '../../components/conversation-details/conversation-details.component';
import {NewChatDialogComponent, NewChatDialogData} from '../../components/new-chat-dialog/new-chat-dialog.component';

@Component({
  selector: 'app-messenger-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrimeTemplate, Drawer, ConversationListComponent, ConversationViewComponent, ConversationDetailsComponent],
  providers: [DialogService],
  templateUrl: './messenger-page.component.html',
  styleUrl: './messenger-page.component.scss'
})
export class MessengerPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(MessengerStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(NotificationService);

  readonly activeId = toSignal(this.route.paramMap.pipe(map(params => {
    const id = Number(params.get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  })), {initialValue: null});

  readonly detailsVisible = signal(false);
  readonly active = computed(() => this.store.conversation(this.activeId()));

  constructor() {
    effect(() => {
      this.activeId();
      untracked(() => this.detailsVisible.set(false));
    });

    effect(() => {
      const lost = this.store.lostAccess();
      if (lost !== null && lost === this.activeId()) {
        untracked(() => {
          this.toast.info('Ви більше не учасник цього чату');
          void this.router.navigate(['/messages'], {replaceUrl: true});
        });
      }
    });
  }

  ngOnInit(): void {
    if (!this.store.conversationsLoaded() && !this.store.conversationsLoading()) {
      this.store.loadConversations();
    }

    // "/messages?to=12" from the directory: open (or create) the chat with the employee.
    const to = Number(this.route.snapshot.queryParamMap.get('to'));
    if (Number.isInteger(to) && to > 0) {
      void this.store.openDirect(to)
        .then(conversation => this.goTo(conversation, true))
        .catch(() => this.router.navigate(['/messages'], {replaceUrl: true}));
    }
  }

  ngOnDestroy(): void {
    this.store.open(null);
  }

  newChat(): void {
    this.openDialog({mode: 'direct'});
  }

  addMembers(): void {
    const conversation = this.active();
    if (conversation) {
      this.openDialog({mode: 'add', conversation});
    }
  }

  async openContact(contact: ChatContact): Promise<void> {
    try {
      this.goTo(await this.store.openDirect(contact.employeeId));
    } catch {
      // The error is shown by the interceptor.
    }
  }

  afterLeave(): void {
    this.detailsVisible.set(false);
    void this.router.navigate(['/messages'], {replaceUrl: true});
  }

  private openDialog(data: NewChatDialogData): void {
    const ref = this.dialogService.open(NewChatDialogComponent, {
      showHeader: false,
      modal: true,
      dismissableMask: true,
      width: '520px',
      breakpoints: {'576px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data
    });
    ref.onClose.subscribe((conversation?: Conversation) => {
      if (conversation) {
        this.goTo(conversation);
      }
    });
  }

  private goTo(conversation: Conversation, replaceUrl = false): void {
    void this.router.navigate(['/messages', conversation.id], {replaceUrl});
  }
}
