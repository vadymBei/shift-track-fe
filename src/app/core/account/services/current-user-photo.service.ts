import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {AccountService} from './account.service';

@Injectable({providedIn: 'root'})
export class CurrentUserPhotoService {
  private readonly accountService = inject(AccountService);

  readonly photoUrl = signal<string | null>(null);
  private loadedFor: number | null = null;

  constructor() {
    effect(() => {
      const employeeId = this.accountService.currentUser()?.employee?.id ?? null;
      untracked(() => {
        if (employeeId === this.loadedFor) return;
        this.loadedFor = employeeId;
        this.setUrl(null);
        if (employeeId) this.load(employeeId);
      });
    });
  }

  refresh(): void {
    if (this.loadedFor) this.load(this.loadedFor);
  }

  private load(employeeId: number): void {
    this.accountService.getProfilePhoto(employeeId).subscribe({
      next: response => {
        if (employeeId !== this.loadedFor) return;
        const blob = response.body;
        const isImage = !!blob && blob.size > 0 && (!blob.type || blob.type.startsWith('image/'));
        this.setUrl(isImage ? URL.createObjectURL(blob) : null);
      },
      error: () => this.setUrl(null)
    });
  }

  private setUrl(url: string | null): void {
    const old = this.photoUrl();
    if (old) URL.revokeObjectURL(old);
    this.photoUrl.set(url);
  }
}
