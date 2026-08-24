import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IAuthenticationForms, IAuthenticationParams } from './authentication.interface';
import { AuthenticationComponentService } from './authentication.service';
import { environment } from '../../environments/environments';
import { Router } from '@angular/router';

@Component({
  selector: 'app-authentication',
  imports: [ReactiveFormsModule],
  templateUrl: './authentication.template.html',
})
export class AuthenticationComponent {
  private readonly componentService = inject(AuthenticationComponentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  loadingStateSignal = this.componentService.isLoading;

  componentForm = this.formBuilder.group<IAuthenticationForms>({
    username: this.formBuilder.control('', [Validators.required]),
    password: this.formBuilder.control('', [Validators.required]),
  });

  private registerJwtLocalStore(jwt: string): void {
    localStorage.setItem(environment.local_storage_keys.jwt, jwt);
  }

  onFormSubmit() {
    if (!this.componentForm.valid) return;

    const inputValues = this.componentForm.getRawValue();
    const payload: IAuthenticationParams = inputValues;

    this.componentService
      .login(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.registerJwtLocalStore(response.access_token);
          return this.router.navigate(['/']);
        },
        error: () => this.componentForm.reset(),
      });
  }
}
