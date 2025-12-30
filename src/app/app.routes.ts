// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard')
      .then(m => m.DashboardComponent)
  },
  {
    path: 'carga',
    loadComponent: () => import('./components/carga-proyecto/carga-proyecto.component')
      .then(m => m.CargaProyectoComponent)
  },
  {
    path: 'dashboard-resultados',
    loadComponent: () => import('./dashboard-resultados/dashboard-resultados.component')
      .then(m => m.DashboardResultadosComponent)
  },
  {
    path: 'estadisticas',
    loadComponent: () => import('./dashboard-resultados/dashboard-resultados.component')
      .then(m => m.DashboardResultadosComponent)
  },
  {
    path: 'visor',
    loadComponent: () => import('./components/visor-geografico/visor-geografico')
      .then(m => m.VisorGeograficoComponent)
  },
];
