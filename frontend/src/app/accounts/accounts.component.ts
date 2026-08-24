import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, switchMap, tap } from 'rxjs';
import { IPagination, IPaginationMetaItem } from '../common/interfaces';
import {
  IAccountItem,
  IAccountRole,
  IAccountsListParams,
  IAccountsSearchForms,
} from './accounts.interface';
import { AccountsComponentService } from './accounts.service';
import { DialogAccountsCreate } from './dialogs/create/create.component';

@Component({
  selector: 'app-accounts',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './accounts.template.html',
})
export class AccountsComponent {
  private readonly componentService = inject(AccountsComponentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(FormBuilder);
  private readonly matDialog: MatDialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  itemsSignal!: Signal<IPagination<IAccountItem> | undefined>;
  loadingStateSignal = this.componentService.isLoading;

  paginationCursorSignal = signal<IAccountsListParams>({
    offset: 0,
    per_page: 10,
    sort: '-created_at',
  });

  componentForm = this.formBuilder.group<IAccountsSearchForms>({
    email: this.formBuilder.control<string | null>(null, [Validators.required, Validators.email]),
    role: this.formBuilder.control<IAccountRole | null>(null),
  });

  constructor() {
    this.itemsSignal = toSignal(this.items$, { initialValue: undefined });
  }

  private readonly items$ = toObservable(this.paginationCursorSignal).pipe(
    switchMap((query) =>
      this.componentService.listAllWithPagination(query).pipe(
        tap((items) => {
          if (!items.data.length) this.snackBar.open('Nada encontrado...', 'Fechar');
        }),
        catchError(() => of(undefined)),
      ),
    ),
  );

  onSubmitSearchForm(): void {
    if (!this.componentForm.valid) return;

    const { email, role } = this.componentForm.getRawValue();

    this.paginationCursorSignal.update((item) => ({
      ...item,
      offset: 0,
      email: email || undefined,
      role: role || undefined,
    }));
  }

  onEventPaginationMeta(cursor: IPaginationMetaItem): void {
    this.paginationCursorSignal.update((item) => ({
      ...item,
      offset: cursor.offset,
    }));
  }

  onClickOpenCreateAccountDialog(): void {
    const dialogRef = this.matDialog
      .open(DialogAccountsCreate, {
        panelClass: ['col-12', 'col-md-10'],
      })
      .afterClosed();

    dialogRef.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((item) => {
      if (item) {
        this.paginationCursorSignal.update((item) => ({
          ...item,
          offset: 0,
        }));
      }
    });
  }
}
