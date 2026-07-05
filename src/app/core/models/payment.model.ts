export type PaymentType = 'LATE_FEE' | 'RESERVATION_FEE' | 'LOST_BOOK_CHARGE' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: number;
  userId: number;
  borrowingRecordId?: number;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentDate: string;
}

/** Mock payment - no real gateway is called server-side either. */
export interface PaymentRequest {
  userId: number;
  borrowingRecordId?: number;
  amount: number;
  type: PaymentType;
}

/** Clears every PENDING payment for this user at once - not a single payment by id. */
export interface AuthorisePaymentRequest {
  username: string;
  amount: number;
}
