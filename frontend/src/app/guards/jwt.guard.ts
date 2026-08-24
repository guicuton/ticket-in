import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../environments/environments';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    if (!payload.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem(environment.local_storage_keys.jwt);

  if (!token || isTokenExpired(token)) {
    return router.createUrlTree(['/login']);
  }

  return true;
};
