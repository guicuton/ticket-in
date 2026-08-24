import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, throwError } from 'rxjs';

export function requestErrorInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const message = getErrorMessage(error);
      snackBar.open(message, 'Fechar');
      return throwError(() => error);
    }),
  );
}

function getErrorMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 400:
      return 'Dados inválidos.';

    case 401:
      return 'Não autorizado.';

    case 403:
      return 'Acesso negado.';

    case 404:
      return 'Recurso não encontrado.';

    case 409:
      return 'Conflito ao realizar a operação.';

    case 422:
      return 'Dados inválidos.';

    case 500:
      return 'Erro interno do servidor.';

    default:
      return 'Ocorreu um erro inesperado.';
  }
}
