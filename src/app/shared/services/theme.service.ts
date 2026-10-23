import {DOCUMENT} from '@angular/common';
import {computed, effect, inject, Injectable, signal} from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'st-theme';
const DARK_CLASS = 'app-dark';

@Injectable({providedIn: 'root'})
export class ThemeService {
  private document = inject(DOCUMENT);
  private media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  private systemPrefersDark = signal<boolean>(this.media?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.readStoredMode());

  readonly isDark = computed(() =>
    this.mode() === 'system' ? this.systemPrefersDark() : this.mode() === 'dark'
  );

  constructor() {
    this.media?.addEventListener('change', e => this.systemPrefersDark.set(e.matches));

    effect(() => {
      const dark = this.isDark();
      const root = this.document.documentElement;
      root.classList.toggle(DARK_CLASS, dark);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
    }
  }

  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private readStoredMode(): ThemeMode {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark' || value === 'system') {
        return value;
      }
    } catch {
    }
    return 'system';
  }
}
