import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { AccountsComponentService } from '../../accounts.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IDialogCreateAccountForm,
  IDialogCreateAccountObservable,
  IDialogCreateAccountParams,
} from './create.interface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'dialog-accounts-create',
  templateUrl: 'create.template.html',
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, ReactiveFormsModule],
})
export class DialogAccountsCreate {
  private readonly dialogRef = inject(MatDialogRef<DialogAccountsCreate, unknown>);
  private readonly componentService = inject(AccountsComponentService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  componentForm = this.formBuilder.group<IDialogCreateAccountForm>({
    username: this.formBuilder.control<string | null>(null, [Validators.required]),
    password: this.formBuilder.control<string | null>(null, [Validators.required]),
    email: this.formBuilder.control<string | null>(null, [Validators.required, Validators.email]),
    role: this.formBuilder.control<string | null>(null, [Validators.required]),
  });

  onFormSubmit() {
    if (!this.componentForm.valid) return;

    const inputValues = this.componentForm.getRawValue();
    const payload = inputValues as IDialogCreateAccountParams;

    this.componentService
      .createItem(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          if (item.id) {
            this.snackBar.open('Usuário criado com sucesso', 'Fechar');
            this.dialogRef.close('success');
          }
        },
        error: () => this.componentForm.reset(),
      });
  }
}
