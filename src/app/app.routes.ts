import { Routes } from '@angular/router';
import { Login } from './features/login/login';
import { Shell } from './layout/shell/shell';
import { Catalogue } from './features/catalogue/catalogue';
import { Lending } from './features/lending/lending';
import { UserManagement } from './features/user-management/user-management';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'books',
        component: Catalogue,
        canActivate: [roleGuard(['USER', 'MANAGER'])],
      },
      {
        path: 'lending',
        component: Lending,
        canActivate: [roleGuard(['MANAGER'])],
      },
      {
        path: 'admin/roles',
        component: UserManagement,
        canActivate: [roleGuard(['ADMIN'])],
      },
      { path: '', pathMatch: 'full', redirectTo: 'books' },
    ],
  },
  { path: '**', redirectTo: '' },
];
