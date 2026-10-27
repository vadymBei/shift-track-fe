import {expect, Page, WebSocketRoute} from '@playwright/test';

const RECORD_SEPARATOR = '\u001e';

/**
 * Replaces the SignalR notifications hub. The app connects with WebSockets and the JSON protocol,
 * so the handshake is answered with an empty message and invocations are pushed as JSON records.
 */
export class NotificationsHub {
  private socket: WebSocketRoute | null = null;
  private connected = false;

  constructor(private readonly page: Page) {
  }

  async install(): Promise<void> {
    await this.page.routeWebSocket(/\/hubs\/shift-track\/notifications/, socket => {
      this.socket = socket;
      this.connected = false;

      socket.onMessage(message => {
        if (String(message).includes('"protocol"')) {
          socket.send(`{}${RECORD_SEPARATOR}`);
          this.connected = true;
        }
      });
    });
  }

  /** Waits until the app has connected and finished the SignalR handshake. */
  async waitForConnection(): Promise<void> {
    await expect.poll(() => this.connected, {message: 'the app did not connect to the notifications hub'})
      .toBe(true);
  }

  /** A new notification for the current user ("notificationReceived"). */
  async notificationReceived(notification: unknown): Promise<void> {
    await this.invoke('notificationReceived', notification);
  }

  /** Notifications were read, resolved or deleted elsewhere ("notificationsChanged"). */
  async notificationsChanged(): Promise<void> {
    await this.invoke('notificationsChanged');
  }

  private async invoke(target: string, ...args: unknown[]): Promise<void> {
    await this.waitForConnection();

    this.socket!.send(JSON.stringify({type: 1, target, arguments: args}) + RECORD_SEPARATOR);
  }
}
