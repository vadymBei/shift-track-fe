import {Page, Request, Route} from '@playwright/test';

export const API_HOST = 'http://localhost:11000';
const API_PREFIX = `${API_HOST}/api/shift-track/`;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Responder = unknown | ((request: Request) => unknown);

interface Handler {
  method: HttpMethod;
  pattern: RegExp;
  respond: Responder;
  status: number;
}

export interface RecordedRequest {
  method: string;
  /** Path after /api/shift-track/, with the query string. */
  path: string;
  body: unknown;
}

/**
 * Replaces the backend: every call to the API is answered here and recorded.
 * Handlers registered later win, so a test can override the defaults.
 * Unknown GET requests get an empty list, other unknown requests an empty object.
 */
export class MockApi {
  readonly requests: RecordedRequest[] = [];
  private readonly handlers: Handler[] = [];

  constructor(private readonly page: Page) {
  }

  /** Answers requests whose path (after /api/shift-track/) matches the pattern. */
  on(method: HttpMethod, pattern: string | RegExp, respond: Responder, status = 200): this {
    const regex = typeof pattern === 'string'
      ? new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`)
      : pattern;

    this.handlers.unshift({method, pattern: regex, respond, status});
    return this;
  }

  /** Requests made to paths matching the pattern. */
  requestsTo(method: HttpMethod, pattern: string | RegExp): RecordedRequest[] {
    return this.requests.filter(x => x.method === method
      && (typeof pattern === 'string' ? x.path.split('?')[0] === pattern : pattern.test(x.path)));
  }

  async install(): Promise<void> {
    await this.page.route(`${API_HOST}/**`, route => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = request.url();

    if (!url.startsWith(API_PREFIX)) {
      await route.fulfill({status: 404});
      return;
    }

    const path = url.substring(API_PREFIX.length);
    const method = request.method() as HttpMethod;

    this.requests.push({method, path, body: request.postDataJSON?.() ?? null});

    const handler = this.handlers.find(x => x.method === method && x.pattern.test(path));

    if (!handler) {
      await route.fulfill({status: 200, contentType: 'application/json', body: method === 'GET' ? '[]' : '{}'});
      return;
    }

    const body = typeof handler.respond === 'function'
      ? (handler.respond as (request: Request) => unknown)(request)
      : handler.respond;

    await route.fulfill({
      status: handler.status,
      contentType: 'application/json',
      body: JSON.stringify(body ?? null)
    });
  }
}
