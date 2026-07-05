export type ReservationStatus = 'RESERVED' | 'NOTIFIED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface Reservation {
  id: number;
  userId: number;
  username: string;
  bookId: number;
  bookTitle: string;
  reservationDate: string;
  status: ReservationStatus;
  queuePosition: number;
}

export interface ReserveRequest {
  bookId: number;
}
