import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.model';
import { AuthService } from './auth.service';

/**
 * Native browser EventSource can't send custom headers, and the SSE endpoint on library-service
 * requires "Authorization: Bearer <jwt>" like everything else. So instead of EventSource, this
 * opens the stream with fetch() (which does support custom headers) and manually reads/parses
 * the text/event-stream body as it arrives, chunk by chunk. No extra dependency needed for
 * something this contained.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/notifications`;

  readonly notifications = signal<AppNotification[]>([]);
  /** Derived from each notification's own `read` flag, not tracked separately, so it can never
   *  drift out of sync with what's actually shown in the panel. */
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Catches up on whatever fired while the user wasn't connected to the live stream - call once
   *  on login/session-restore, alongside connect(). */
  fetchMine(): Observable<AppNotification[]> {
    return this.http
      .get<AppNotification[]>(`${this.baseUrl}/mine`)
      .pipe(tap((incoming) => this.mergeIncoming(incoming)));
  }

  /** Marks a single notification read, server-side and locally. */
  markRead(id: number): void {
    this.http.post<AppNotification>(`${this.baseUrl}/${id}/read`, {}).subscribe((updated) => {
      this.notifications.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
    });
  }

  /** Called when the notification panel is opened - clears the badge by marking every unread
   *  notification read server-side, not just hiding the count locally. */
  markAllAsRead(): void {
    for (const notification of this.notifications()) {
      if (!notification.read) {
        this.markRead(notification.id);
      }
    }
  }

  connect(): void {
    const user = this.auth.currentUser();
    const token = this.auth.getToken();
    if (!user || !token || this.abortController) {
      return; // already connected, or nothing to connect with
    }
    this.openStream(user.userId, token);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
  }

  /** Call on logout - disconnect() alone leaves stale notifications in the signal, so the next
   *  person to log in on this tab would see the previous user's notifications until they refresh. */
  reset(): void {
    this.disconnect();
    this.notifications.set([]);
  }

  /** "Clear" button in the notification panel - local only, no backend call. By the time this is
   *  clickable everything's already marked read server-side (see markAllAsRead), so this just
   *  empties what's shown; nothing is lost. */
  clear(): void {
    this.notifications.set([]);
  }

  private mergeIncoming(incoming: AppNotification[]): void {
    this.notifications.update((list) => {
      const existingIds = new Set(list.map((n) => n.id));
      const additions = incoming.filter((n) => !existingIds.has(n.id));
      return [...additions, ...list];
    });
  }

  private async openStream(userId: number, token: string): Promise<void> {
    this.abortController = new AbortController();
    const url = `${environment.apiBaseUrl}/api/notifications/stream/${userId}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: this.abortController.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Notification stream returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE frames are separated by a blank line; each frame's payload is one or more
      // "data: ..." lines. This service only ever sends single-line JSON payloads.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            const notification: AppNotification = JSON.parse(json);
            this.mergeIncoming([notification]);
          } catch {
            // Malformed frame - skip it rather than taking the whole stream down.
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        return; // disconnect() was called deliberately - not an error
      }
      console.warn('Notification stream dropped, retrying in 5s', err);
    }

    this.abortController = null;
    // Auto-reconnect while the user is still logged in - covers transient network blips and
    // notification-service/library-service restarts without the user having to refresh.
    if (this.auth.isLoggedIn()) {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }
}
