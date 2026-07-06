import { Role } from './role.model';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

/** UserDto - never carries passwordHash back to the frontend; that field is writeOnly server-side. */
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  status: UserStatus;
  role: Role;
  userGroupId?: number;
}

export interface UpdateUserRoleRequest {
  role: Role;
}

export interface UpdateUserGroupRequest {
  userGroupId: number;
}

/** My profile - active loans, reservations, balance (GET /api/users/me). */
export interface UserProfile {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  status: string;
  role: string;
  userGroupName: string;
  maxBooksAllowed: number;
  loanDurationDays: number;
  activeLoanCount: number;
  activeReservationCount: number;
  /** Nullable - the backend's BigDecimal can be absent when the user has never owed anything. */
  outstandingBalance: number | null;
}

export interface UserBorrowingHistory {
  borrowingRecordId: number;
  bookId: number;
  bookTitle: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: string;
  lateFee: number;
}
