import { Routes } from '@angular/router';
import { AuthenticationComponent } from './authentication/authentication.component';
import { authGuard } from './guards/jwt.guard';
import { HomeComponent } from './home/home.component';

const formatTitle = (area: string): string => {
  return `Ticket-In | ${area}`;
};

export const routes: Routes = [
  {
    path: '',
    title: formatTitle('Home'),
    component: HomeComponent,
    canActivate: [authGuard],
  },
  {
    path: 'login',
    title: formatTitle('Login'),
    component: AuthenticationComponent,
  },
];
