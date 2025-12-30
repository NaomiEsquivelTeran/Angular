import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PanelLateralComponent } from './components/panel-lateral/panel-lateral.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PanelLateralComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  title = 'Geocodificador';

  closeSidebar() {
    console.log('Sidebar cerrado desde AppComponent');

  }
}
