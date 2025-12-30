import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard/dashboard';  // ← Cambia esto
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DirectionService } from './services/direction.service';

describe('DashboardComponent', () => {  // ← Cambia el nombre del describe
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],  // ← Importa DashboardComponent
      providers: [
        DirectionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create the dashboard', () => {
    const fixture = TestBed.createComponent(DashboardComponent);  // ← Cambia esto
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should have loading state', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    expect(component.cargando).toBe(false);  // Inicialmente debería ser false
  });

  it('should have empty direcciones array initially', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    expect(component.direcciones).toEqual([]);
  });
});
