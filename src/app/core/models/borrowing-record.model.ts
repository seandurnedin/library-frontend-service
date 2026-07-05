export type BorrowingStatus = 'ON_LOAN' | 'RETURNED' | 'OVERDUE' | 'LOST';

export interface BorrowingRecord {
  id: number;
  userId: number;
  username: string;
  bookId: number;
  bookTitle: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: BorrowingStatus;
  lateFee: number;
}

export interface LoanRequest {
  username: string;
  isbn: string;
}

export interface ReturnRequest {
  username: string;
  isbn: string;
}
