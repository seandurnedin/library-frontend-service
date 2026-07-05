export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  message: string;
  bookId?: number;
  bookTitle?: string;
  read: boolean;
  timestamp: string;
}
