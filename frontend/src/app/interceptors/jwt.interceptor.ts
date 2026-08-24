import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

const findTokenFromLocalStorage = (req: HttpRequest<unknown>) => {
  const key = environment.local_storage_keys.jwt;
  const jwt = localStorage.getItem(key);

  if (!jwt) return req;

  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${jwt}`,
    },
  });
};

export function jwtInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  return next(findTokenFromLocalStorage(req));
}
