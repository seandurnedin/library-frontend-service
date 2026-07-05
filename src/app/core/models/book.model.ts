export type BookStatus = 'IN_STORE' | 'ON_LOAN' | 'RESERVED' | 'LOST';

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher?: string;
  publishedYear?: number;
  genre?: string;
  totalCopies: number;
  availableCopies: number;
  status: BookStatus;
}

export interface AddBookRequest {
  isbn: string;
  title: string;
  author: string;
  publisher?: string;
  publishedYear?: number;
  genre?: string;
  totalCopies?: number;
}

export interface UpdateBookRequest {
  title?: string;
  author?: string;
  publisher?: string;
  publishedYear?: number;
  genre?: string;
  totalCopies?: number;
}
