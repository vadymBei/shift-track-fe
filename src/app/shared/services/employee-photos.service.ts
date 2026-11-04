import {HttpClient, HttpContext} from '@angular/common/http';
import {effect, inject, Injectable, signal, Signal, untracked, WritableSignal} from '@angular/core';
import {SKIP_ERROR_NOTIFICATION} from '../interceptors/error.interceptor';
import {AccountService} from '../../core/account/services/account.service';

/** An employee who has a photo; the version changes with the photo. */
export interface EmployeePhoto {
  employeeId: number;
  version: string;
}

/** How many employees one request for versions asks about (the API allows 500). */
const BATCH = 200;
const NO_PHOTO = signal<string | null>(null).asReadonly();
const SILENT = () => new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

/**
 * Photos of employees as object URLs, loaded once per session.
 * Avatars ask for ids; the ids asked at once go in one request for versions, and only the photos
 * that exist are downloaded — by version, so the browser keeps them in its cache between sessions.
 */
@Injectable({providedIn: 'root'})
export class EmployeePhotosService {
  private readonly http = inject(HttpClient);

  private readonly urls = new Map<number, WritableSignal<string | null>>();
  private readonly versions = new Map<number, string | null>();
  private readonly pending = new Set<number>();
  private flushQueued = false;
  /** Changes when the cache is dropped, so that avatars ask again. */
  private readonly generation = signal(0);

  constructor() {
    // Another user signed in: the photos stay the same, but the cache is the session's.
    const account = inject(AccountService);
    let userId: number | null | undefined;
    effect(() => {
      const id = account.currentUser()?.employee?.id ?? null;
      untracked(() => {
        if (userId !== undefined && id !== userId) this.clear();
        userId = id;
      });
    });
  }

  /** The object URL of the photo, null while it loads or without one. Reactive: can be read in a computed. */
  photo(employeeId: number | null | undefined): Signal<string | null> {
    this.generation();
    if (!employeeId || employeeId <= 0) return NO_PHOTO;

    let url = this.urls.get(employeeId);
    if (!url) {
      url = signal<string | null>(null);
      this.urls.set(employeeId, url);
      this.pending.add(employeeId);
      this.queueFlush();
    }
    return url.asReadonly();
  }

  /** After the photo of the employee was changed here; null when it was removed. */
  changed(employeeId: number, version: string | null): void {
    this.photo(employeeId);
    this.pending.delete(employeeId);
    this.apply(employeeId, version);
  }

  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    // After the current render, when every avatar on the page has asked.
    setTimeout(() => {
      this.flushQueued = false;
      const ids = [...this.pending];
      this.pending.clear();
      for (let i = 0; i < ids.length; i += BATCH) this.loadVersions(ids.slice(i, i + BATCH));
    });
  }

  private loadVersions(ids: number[]): void {
    const generation = untracked(this.generation);
    this.http.get<EmployeePhoto[]>('organization/employees/photos', {params: {ids: ids.map(String)}, context: SILENT()})
      .subscribe({
        next: photos => {
          if (generation !== untracked(this.generation)) return;
          const found = new Map(photos.map(x => [x.employeeId, x.version]));
          for (const id of ids) {
            if (!this.versions.has(id)) this.apply(id, found.get(id) ?? null);
          }
        },
        // Initials stay; the next session asks again.
        error: () => undefined
      });
  }

  private apply(employeeId: number, version: string | null): void {
    if (this.versions.get(employeeId) === version && this.versions.has(employeeId)) return;
    this.versions.set(employeeId, version);

    if (!version) {
      this.setUrl(employeeId, null);
      return;
    }

    this.http.get(`organization/employees/${employeeId}/photo`, {
      params: {v: version},
      responseType: 'blob',
      context: SILENT()
    }).subscribe({
      next: blob => {
        if (this.versions.get(employeeId) !== version) return;
        const isImage = blob.size > 0 && blob.type.startsWith('image/');
        this.setUrl(employeeId, isImage ? URL.createObjectURL(blob) : null);
      },
      error: () => undefined
    });
  }

  private setUrl(employeeId: number, value: string | null): void {
    const url = this.urls.get(employeeId);
    if (!url) {
      if (value) URL.revokeObjectURL(value);
      return;
    }
    const old = url();
    if (old) URL.revokeObjectURL(old);
    url.set(value);
  }

  private clear(): void {
    for (const url of this.urls.values()) {
      const value = url();
      if (value) URL.revokeObjectURL(value);
      url.set(null);
    }
    this.urls.clear();
    this.versions.clear();
    this.pending.clear();
    this.generation.update(x => x + 1);
  }
}
