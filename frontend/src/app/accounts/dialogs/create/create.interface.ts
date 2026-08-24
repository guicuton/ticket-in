import { FormControl } from '@angular/forms';

export interface IDialogCreateAccountForm {
  username: FormControl<string | null>;
  password: FormControl<string | null>;
  email: FormControl<string | null>;
  role: FormControl<string | null>;
}

export interface IDialogCreateAccountParams {
  username: string;
  password: string;
  email: string;
  role: string;
}

export interface IDialogCreateAccountObservable {
  id: string;
}
