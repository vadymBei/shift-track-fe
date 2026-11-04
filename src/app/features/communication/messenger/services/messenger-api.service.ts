import {HttpClient, HttpContext, HttpEvent} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {SKIP_ERROR_NOTIFICATION} from '../../../../shared/interceptors/error.interceptor';
import {ChatAttachment, ChatContact, ChatMessage, Conversation, MessageSearch, MessengerUnreadCount} from '../models/messenger.models';

export const MESSAGES_PAGE = 50;

/** Background calls: a failure is retried or ignored, the user doesn't need a toast. */
const quiet = () => ({context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true)});

@Injectable({providedIn: 'root'})
export class MessengerApiService {
  private readonly http = inject(HttpClient);
  private readonly path = 'communication/messenger';

  getConversations(take = 100): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.path}/conversations`, {params: {take}, ...quiet()});
  }

  getConversation(id: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.path}/conversations/${id}`, quiet());
  }

  openDirect(employeeId: number): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.path}/conversations/direct`, {employeeId});
  }

  createGroup(title: string, memberIds: number[]): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.path}/conversations/groups`, {title, memberIds});
  }

  renameGroup(id: number, title: string): Observable<Conversation> {
    return this.http.put<Conversation>(`${this.path}/conversations/${id}/title`, {title});
  }

  addMembers(id: number, employeeIds: number[]): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.path}/conversations/${id}/members`, {employeeIds});
  }

  removeMember(id: number, employeeId: number): Observable<Conversation> {
    return this.http.delete<Conversation>(`${this.path}/conversations/${id}/members/${employeeId}`);
  }

  setMuted(id: number, muted: boolean): Observable<Conversation> {
    return this.http.put<Conversation>(`${this.path}/conversations/${id}/muted`, {muted});
  }

  leave(id: number): Observable<unknown> {
    return this.http.post(`${this.path}/conversations/${id}/leave`, {});
  }

  markRead(id: number, messageId: number): Observable<unknown> {
    return this.http.put(`${this.path}/conversations/${id}/read`, {messageId}, quiet());
  }

  typing(id: number): Observable<unknown> {
    return this.http.post(`${this.path}/conversations/${id}/typing`, {}, quiet());
  }

  /** Messages before beforeId (or the newest), oldest first. */
  /** With untilId the page reaches back to that message, and has `take` more before it. */
  getMessages(id: number, beforeId?: number | null, take = MESSAGES_PAGE, untilId?: number): Observable<ChatMessage[]> {
    const params: Record<string, number> = {take};
    if (beforeId) {
      params['beforeId'] = beforeId;
    }
    if (untilId) {
      params['untilId'] = untilId;
    }
    return this.http.get<ChatMessage[]>(`${this.path}/conversations/${id}/messages`, {params, ...quiet()});
  }

  searchMessages(id: number, query: string): Observable<MessageSearch> {
    return this.http.get<MessageSearch>(`${this.path}/conversations/${id}/messages/search`, {params: {q: query}, ...quiet()});
  }

  /** Errors are shown by the message itself ("not sent, retry"), not by a toast. */
  send(id: number, text: string, clientMessageId: string, replyToMessageId: number | null,
       attachmentIds: number[] = []): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.path}/conversations/${id}/messages`,
      {text, clientMessageId, replyToMessageId, attachmentIds}, quiet());
  }

  /** With the upload progress; errors are shown on the file. */
  uploadAttachment(conversationId: number, file: File): Observable<HttpEvent<ChatAttachment>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ChatAttachment>(`${this.path}/conversations/${conversationId}/attachments`, form,
      {reportProgress: true, observe: 'events', ...quiet()});
  }

  /** An upload that wasn't sent. */
  removeAttachment(id: number): Observable<unknown> {
    return this.http.delete(`${this.path}/attachments/${id}`, quiet());
  }

  /** The file needs the token, so it comes as a blob, not by a link. */
  getAttachment(id: number, download = false): Observable<Blob> {
    return this.http.get(`${this.path}/attachments/${id}`, {params: {download}, responseType: 'blob', ...quiet()});
  }

  edit(messageId: number, text: string): Observable<ChatMessage> {
    return this.http.put<ChatMessage>(`${this.path}/messages/${messageId}`, {text});
  }

  delete(messageId: number): Observable<ChatMessage> {
    return this.http.delete<ChatMessage>(`${this.path}/messages/${messageId}`);
  }

  getUnreadCount(): Observable<MessengerUnreadCount> {
    return this.http.get<MessengerUnreadCount>(`${this.path}/unread/count`, quiet());
  }

  searchContacts(search: string): Observable<ChatContact[]> {
    return this.http.get<ChatContact[]>(`${this.path}/contacts`, {params: {search}, ...quiet()});
  }
}
