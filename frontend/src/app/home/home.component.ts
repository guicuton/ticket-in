import { Component } from '@angular/core';
import { AccountsComponent } from '../accounts/accounts.component';

@Component({
  selector: 'app-home',
  imports: [AccountsComponent],
  templateUrl: './home.template.html',
})
export class HomeComponent {}
