import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-panel-lateral',
  templateUrl: './panel-lateral.component.html',
  styleUrls: ['./panel-lateral.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive]
})
export class PanelLateralComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  closeSidebar() {
    this.closed.emit();
  }
}
