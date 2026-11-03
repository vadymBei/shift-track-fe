import {Routes, UrlMatchResult, UrlSegment} from '@angular/router';

/**
 * "/messages" and "/messages/:id" are one route, so switching chats keeps the page
 * (and the list scroll) instead of creating it again.
 */
export default [
  {
    matcher: (segments: UrlSegment[]): UrlMatchResult | null => segments.length <= 1
      ? {consumed: segments, posParams: segments.length ? {id: segments[0]} : {}}
      : null,
    loadComponent: () => import('./pages/messenger-page/messenger-page.component')
      .then(m => m.MessengerPageComponent)
  }
] satisfies Routes;
