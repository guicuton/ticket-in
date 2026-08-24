import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { defer, finalize, Observable } from 'rxjs';
import { environment } from '../../environments/environments';
import { IAuthenticationObservable, IAuthenticationParams } from './authentication.interface';

@Service()
export class AuthenticationComponentService {
  private readonly endpoints = environment.endpoints.accounts;
  private readonly http = inject(HttpClient);
  private readonly isLoadingSignal = signal(false);
  readonly isLoading = this.isLoadingSignal.asReadonly();

  login(data: IAuthenticationParams): Observable<IAuthenticationObservable> {
    return defer(() => {
      this.isLoadingSignal.set(true);
      return this.http
        .post<IAuthenticationObservable>(this.endpoints.login, data)
        .pipe(finalize(() => this.isLoadingSignal.set(false)));
    });
  }
}
