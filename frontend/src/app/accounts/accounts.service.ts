import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { defer, finalize, Observable } from 'rxjs';
import { environment } from '../../environments/environments';
import { IAccountItem, IAccountsListParams } from './accounts.interface';
import { IPagination } from '../common/interfaces';
import {
  IDialogCreateAccountObservable,
  IDialogCreateAccountParams,
} from './dialogs/create/create.interface';

@Service()
export class AccountsComponentService {
  private readonly endpoints = environment.endpoints.accounts;
  private readonly http = inject(HttpClient);
  private readonly isLoadingSignal = signal(false);
  readonly isLoading = this.isLoadingSignal.asReadonly();

  createItem(params: IDialogCreateAccountParams): Observable<IDialogCreateAccountObservable> {
    return defer(() => {
      this.isLoadingSignal.set(true);
      return this.http
        .post<IDialogCreateAccountObservable>(this.endpoints.create, params)
        .pipe(finalize(() => this.isLoadingSignal.set(false)));
    });
  }

  listAllWithPagination(params: IAccountsListParams): Observable<IPagination<IAccountItem>> {
    return defer(() => {
      this.isLoadingSignal.set(true);
      return this.http
        .get<IPagination<IAccountItem>>(this.endpoints.list, {
          params: Object.entries(params).reduce(
            (query, [key, value]) => (value === undefined ? query : query.set(key, value)),
            new HttpParams(),
          ),
        })
        .pipe(finalize(() => this.isLoadingSignal.set(false)));
    });
  }
}
