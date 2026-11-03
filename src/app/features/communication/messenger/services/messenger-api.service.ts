import {HttpClient, HttpContext} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {SKIP_ERROR_NOTIFICATION} from '../../../../shared/interceptors/error.interceptor';
import {ChatContact, ChatMessage, Conversation, MessengerUnreadCount} from '../models/messenger.models';

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
  getMessages(id: number, beforeId?: number | null, take = MESSAGES_PAGE): Observable<ChatMessage[]> {
    const params: Record<string, number> = {take};
    if (beforeId) {
      params['beforeId'] = beforeId;
    }
    return this.http.get<ChatMessage[]>(`${this.path}/conversations/${id}/messages`, {params, ...quiet()});
  }

  /** Errors are shown by the message itself ("not sent, retry"), not by a toast. */
  send(id: number, text: string, clientMessageId: string, replyToMessageId: number | null): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.path}/conversations/${id}/messages`,
      {text, clientMessageId, replyToMessageId}, quiet());
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
