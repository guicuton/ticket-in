import { Component } from '@angular/core';
import { AccountsComponent } from '../accounts/accounts.component';
import { AreasComponent } from '../areas/areas.component';
import { TicketsComponent } from '../tickets/tickets.component';

@Component({
  selector: 'app-home',
  imports: [AccountsComponent, AreasComponent, TicketsComponent],
  templateUrl: './home.template.html',
})
export class HomeComponent {}
