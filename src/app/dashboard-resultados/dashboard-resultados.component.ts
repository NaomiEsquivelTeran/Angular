import { Component, OnInit, AfterViewInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js/auto';
import { EstadisticaService } from '../dashboard-resultados/estadistica.service';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface Estadisticas {
  totalRegistros: number;
  exactos: number;
  revision: number;
  fallidos: number;
}

interface CalidadDatos {
  alta: number;
  medio: number;
  bajo: number;
  muyBajo: number;
}

interface ApiResponse {
  datos?: any;
  estadisticas?: Estadisticas;
  calidad?: CalidadDatos;
  totalRegistros?: number;
  exactos?: number;
  revision?: number;
  fallidos?: number;
  total?: number;
}

@Component({
  selector: 'app-dashboard-resultados',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-resultados.component.html',
  styleUrls: ['./dashboard-resultados.component.css']
})
export class DashboardResultadosComponent implements OnInit, AfterViewInit, OnDestroy {
  private estadisticaService = inject(EstadisticaService);
  private http = inject(HttpClient);
  private cdRef = inject(ChangeDetectorRef);
  private router = inject(Router);

  private dataSubscription = new Subscription();

  estadisticas: Estadisticas = { totalRegistros: 0, exactos: 0, revision: 0, fallidos: 0 };
  calidadDatos: CalidadDatos = { alta: 0, medio: 0, bajo: 0, muyBajo: 0 };

  isLoading = true;
  hasError = false;
  errorMessage = '';
  datosCargados = false;
  today = new Date();

  descargando = false;
  formatoDescarga: 'excel' | 'csv' = 'excel';

  private chart: Chart | null = null;

  private readonly COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
  private readonly CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          font: { size: 14, family: "'Segoe UI', sans-serif" },
          color: '#374151'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8
      }
    },
    cutout: '65%'
  };

  get porcentajeExactos(): string { return this.calcularPorcentaje(this.estadisticas.exactos); }
  get porcentajeRevision(): string { return this.calcularPorcentaje(this.estadisticas.revision); }
  get porcentajeFallidos(): string { return this.calcularPorcentaje(this.estadisticas.fallidos); }

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  cargarEstadisticas(): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';
    this.dataSubscription.unsubscribe();

    this.dataSubscription = this.estadisticaService.obtenerDashboard().subscribe({
      next: (data: ApiResponse) => this.procesarRespuesta(data),
      error: (error: Error) => this.manejarError(error)
    });
  }

  visualizarEnMapa(): void {
    if (!this.datosCargados || this.estadisticas.totalRegistros === 0) {
      alert('No hay datos para visualizar en el mapa');
      return;
    }

    this.router.navigate(['/visor'], {
      state: {
        fromDashboard: true,
        estadisticas: this.estadisticas,
        calidadData: this.calidadDatos
      }
    });
  }

  descargarReporteDirecto(): void {
    if (!this.datosCargados || this.estadisticas.totalRegistros === 0) {
      alert('No hay datos para descargar');
      return;
    }

    if (this.descargando) return;

    this.descargando = true;

    this.http.get<any>('http://localhost:3000/api/lotes/disponibles')
      .subscribe({
        next: (response: any) => {
          if (response.success && response.lotes && response.lotes.length > 0) {
            const ultimoLote = response.lotes[0];
            const idLote = ultimoLote.id_lote;

            this.descargarReporte(idLote);
          } else {
            alert('No hay lotes disponibles para descargar');
            this.descargando = false;
          }
        },
        error: (error: Error) => {
          alert(`❌ Error al obtener lotes: ${error.message}`);
          this.descargando = false;
        }
      });
  }

  private descargarReporte(idLote: number): void {
    this.http.get(`http://localhost:3000/api/lotes/${idLote}/descargar?formato=${this.formatoDescarga}`, {
      responseType: 'blob'
    })
      .subscribe({
        next: (blob: Blob) => {
          const extension = this.getExtension(this.formatoDescarga);
          const nombreArchivo = `reporte-lote-${idLote}-${new Date().toISOString().slice(0, 10)}.${extension}`;

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = nombreArchivo;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          alert(`✅ Reporte "${nombreArchivo}" se descargó exitosamente.`);
          this.descargando = false;
        },
        error: (error: Error) => {
          alert(`❌ Error al descargar el reporte: ${error.message}`);
          this.descargando = false;
        }
      });
  }

  private getExtension(formato: string): string {
    switch (formato) {
      case 'excel': return 'xlsx';
      case 'csv': return 'csv';
      default: return 'xlsx';
    }
  }

  private procesarRespuesta(data: ApiResponse): void {
    if (this.estaVacio(data)) {
      this.mostrarSinDatos();
    } else {
      this.procesarDatos(data);
      this.datosCargados = true;
      setTimeout(() => this.inicializarGrafica(), 100);
    }

    this.isLoading = false;
    this.cdRef.detectChanges();
  }

  private manejarError(error: Error): void {
    console.error('❌ Error:', error);
    this.hasError = true;
    this.errorMessage = error.message || 'Error al conectar con el servidor';
    this.isLoading = false;
    this.datosCargados = false;
    this.cdRef.detectChanges();
  }

  private estaVacio(data: ApiResponse): boolean {
    if (!data) return true;

    const datos = data.datos || data;

    if (datos.totalRegistros !== undefined) {
      return datos.totalRegistros === 0 || datos.totalRegistros === null;
    }

    if (datos.estadisticas?.totalRegistros !== undefined) {
      return datos.estadisticas.totalRegistros === 0 || datos.estadisticas.totalRegistros === null;
    }

    if (datos.total !== undefined) {
      return datos.total === 0 || datos.total === null;
    }

    return true;
  }

  private procesarDatos(data: ApiResponse): void {
    try {
      const datos = data.datos || data;

      if (datos.totalRegistros !== undefined) {
        this.estadisticas = {
          totalRegistros: datos.totalRegistros || 0,
          exactos: datos.exactos || 0,
          revision: datos.revision || 0,
          fallidos: datos.fallidos || 0
        };

        this.calidadDatos = datos.calidad
          ? { ...datos.calidad }
          : this.calcularCalidadDesdeTotales();

      } else if (datos.estadisticas) {
        this.estadisticas = { ...datos.estadisticas };
        this.calidadDatos = datos.calidad
          ? { ...datos.calidad }
          : this.calcularCalidadDesdeTotales();
      } else {
        this.mostrarSinDatos();
      }
    } catch (error) {
      console.error('💥 Error procesando datos:', error);
      this.mostrarSinDatos();
    }
  }

  private inicializarGrafica(): void {
    if (!this.datosCargados || this.estadisticas.totalRegistros === 0) {
      this.mostrarMensajeGraficaVacia();
      return;
    }

    const canvas = document.getElementById('graficaCalidad') as HTMLCanvasElement;
    if (!canvas) return;

    this.destruirGrafica();

    if (this.sumaCalidad === 0) {
      this.mostrarMensajeGraficaVacia();
      return;
    }

    try {
      this.chart = new Chart(canvas.getContext('2d')!, {
        type: 'doughnut',
        data: this.obtenerDatosGrafica(),
        options: this.CHART_OPTIONS
      });
    } catch (error) {
      console.error('💥 Error creando gráfica:', error);
    }
  }

  private obtenerDatosGrafica() {
    return {
      labels: [
        `Alta ${this.calidadDatos.alta.toFixed(1)}%`,
        `Medio ${this.calidadDatos.medio.toFixed(1)}%`,
        `Bajo ${this.calidadDatos.bajo.toFixed(1)}%`,
        `Muy Bajo ${this.calidadDatos.muyBajo.toFixed(1)}%`
      ],
      datasets: [{
        data: Object.values(this.calidadDatos),
        backgroundColor: this.COLORS,
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 15
      }]
    };
  }

  private calcularCalidadDesdeTotales(): CalidadDatos {
    const total = this.estadisticas.totalRegistros || 1;

    return {
      alta: total > 0 ? (this.estadisticas.exactos / total) * 100 : 0,
      medio: total > 0 ? (this.estadisticas.revision / 2 / total) * 100 : 0,
      bajo: total > 0 ? (this.estadisticas.revision / 2 / total) * 100 : 0,
      muyBajo: total > 0 ? (this.estadisticas.fallidos / total) * 100 : 0
    };
  }

  private mostrarSinDatos(): void {
    this.hasError = false;
    this.errorMessage = 'No hay datos disponibles en la base de datos';
    this.datosCargados = false;
    this.resetDatos();
  }

  private mostrarMensajeGraficaVacia(): void {
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="empty-chart-message">
          <div class="empty-icon">📊</div>
          <h4>No hay datos para mostrar</h4>
          <p>La base de datos está vacía o no hay registros procesados</p>
        </div>
      `;
    }
  }

  private calcularPorcentaje(valor: number): string {
    if (this.estadisticas.totalRegistros === 0) return '0.0%';
    return ((valor / this.estadisticas.totalRegistros) * 100).toFixed(1) + '%';
  }

  private resetDatos(): void {
    this.estadisticas = { totalRegistros: 0, exactos: 0, revision: 0, fallidos: 0 };
    this.calidadDatos = { alta: 0, medio: 0, bajo: 0, muyBajo: 0 };
    this.destruirGrafica();
  }

  private limpiarSubscripcion(): void {
    this.dataSubscription.unsubscribe();
  }

  private destruirGrafica(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private cleanup(): void {
    this.limpiarSubscripcion();
    this.destruirGrafica();
  }

  private get sumaCalidad(): number {
    return Object.values(this.calidadDatos).reduce((a, b) => a + b, 0);
  }
}
