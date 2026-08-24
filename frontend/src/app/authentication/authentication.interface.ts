import { FormControl } from '@angular/forms';

export interface IAuthenticationParams {
  username: string;
  password: string;
}

export interface IAuthenticationObservable {
  access_token: string;
}

export interface IAuthenticationForms {
  username: FormControl<string>;
  password: FormControl<string>;
}
