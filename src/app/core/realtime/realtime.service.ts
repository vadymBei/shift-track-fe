import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel} from '@microsoft/signalr';
import {AccountService} from '../account/services/account.service';
import {NOTIFICATIONS_HUB_URL} from '../../shared/constants/api.constants';

const RESTART_DELAY_MS = 30_000;

type Handler = (...args: any[]) => void;

/**
 * The one SignalR connection of the signed-in user. Notifications and the messenger subscribe to
 * their events here; subscriptions live across reconnects and the connections of other users.
 * After a reconnect some events may have been missed, so subscribers reload what they show.
 */
@Injectable({providedIn: 'root'})
export class RealtimeService {
  private readonly accountService = inject(AccountService);

  /** True while connected; false before the first connection, while reconnecting and signed out. */
  readonly connected = signal(false);

  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly reconnectedHandlers = new Set<() => void>();

  private employeeId: number | null = null;
  private connection: HubConnection | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const employeeId = this.accountService.currentUser()?.employee?.id ?? null;
      untracked(() => this.onUserChanged(employeeId));
    });
  }

  /** Calls the handler for every "method" message from the server. Returns the unsubscribe function. */
  on<T>(method: string, handler: (payload: T) => void): () => void {
    let set = this.handlers.get(method);

    if (!set) {
      set = new Set();
      this.handlers.set(method, set);
      this.connection?.on(method, (...args: unknown[]) => this.dispatch(method, args));
    }

    set.add(handler);
    return () => set!.delete(handler);
  }

  /** Called after the connection is restored. */
  onReconnected(handler: () => void): () => void {
    this.reconnectedHandlers.add(handler);
    return () => this.reconnectedHandlers.delete(handler);
  }

  private dispatch(method: string, args: unknown[]): void {
    for (const handler of this.handlers.get(method) ?? []) {
      handler(...args);
    }
  }

  private onUserChanged(employeeId: number | null): void {
    if (employeeId === this.employeeId) {
      return;
    }
    this.employeeId = employeeId;
    void this.stopConnection();

    if (employeeId) {
      void this.startConnection();
    }
  }

  private async startConnection(): Promise<void> {
    this.clearRestart();

    const connection = new HubConnectionBuilder()
      .withUrl(NOTIFICATIONS_HUB_URL, {
        accessTokenFactory: () => this.accountService.token()?.accessToken ?? '',
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    for (const method of this.handlers.keys()) {
      connection.on(method, (...args: unknown[]) => this.dispatch(method, args));
    }

    connection.onreconnecting(() => this.connected.set(false));
    connection.onreconnected(() => {
      this.connected.set(true);
      this.reconnectedHandlers.forEach(handler => handler());
    });
    connection.onclose(() => {
      this.connected.set(false);
      this.scheduleRestart(connection);
    });

    this.connection = connection;

    try {
      await connection.start();
      this.connected.set(connection === this.connection);
    } catch {
      this.scheduleRestart(connection);
    }
  }

  private async stopConnection(): Promise<void> {
    this.clearRestart();
    this.connected.set(false);
    const connection = this.connection;
    this.connection = null;
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      await connection.stop().catch(() => undefined);
    }
  }

  private scheduleRestart(connection: HubConnection): void {
    if (connection !== this.connection || !this.employeeId) {
      return;
    }
    this.clearRestart();
    this.restartTimer = setTimeout(() => {
      if (connection === this.connection && connection.state === HubConnectionState.Disconnected) {
        connection.start()
          .then(() => {
            this.connected.set(true);
            // Started again after a close: the same as a reconnect for the subscribers.
            this.reconnectedHandlers.forEach(handler => handler());
          })
          .catch(() => this.scheduleRestart(connection));
      }
    }, RESTART_DELAY_MS);
  }

  private clearRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
