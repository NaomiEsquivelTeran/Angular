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
  idLote?: number;
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
  calidadPorcentajes: CalidadDatos = { alta: 0, medio: 0, bajo: 0, muyBajo: 0 };

  isLoading = true;
  hasError = false;
  errorMessage = '';
  datosCargados = false;
  today = new Date();

  descargando = false;
  idLoteActual: number | null = null;

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

  get porcentajeAlta(): number { return this.calidadPorcentajes.alta; }
  get porcentajeMedio(): number { return this.calidadPorcentajes.medio; }
  get porcentajeBajo(): number { return this.calidadPorcentajes.bajo; }
  get porcentajeMuyBajo(): number { return this.calidadPorcentajes.muyBajo; }

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  ngAfterViewInit(): void {}

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

  descargarInformacionCompleta(): void {
    if (!this.datosCargados || this.estadisticas.totalRegistros === 0) {
      alert('No hay datos para descargar');
      return;
    }

    if (this.descargando) return;

    this.descargando = true;
    this.cdRef.detectChanges();

    const url = `http://localhost:3000/api/descargar/informacion-completa?formato=excel`;

    this.http.get(url, {
      responseType: 'blob'
    })
      .subscribe({
        next: (blob: Blob) => {
          const fecha = new Date().toISOString().slice(0, 10);
          const nombreArchivo = `informacion-completa-${fecha}.xlsx`;

          const urlDescarga = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = urlDescarga;
          link.download = nombreArchivo;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(urlDescarga);

          this.descargando = false;
          this.cdRef.detectChanges();
        },
        error: (error: any) => {
          let mensajeError = 'Error al descargar el reporte';
          if (error.status === 404) {
            mensajeError = 'El servicio de reportes no está disponible. Verifica la URL del endpoint.';
          } else if (error.status === 500) {
            mensajeError = 'Error interno del servidor al generar el reporte completo';
          } else if (error.error instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const errorJson = JSON.parse(reader.result as string);
                mensajeError = errorJson.error || errorJson.detalle || mensajeError;
              } catch {
                mensajeError = 'Error al procesar la respuesta del servidor';
              }
              alert(mensajeError);
            };
            reader.readAsText(error.error);
          } else if (error.message) {
            mensajeError = error.message;
            alert(mensajeError);
          }

          this.descargando = false;
          this.cdRef.detectChanges();
        }
      });
  }

  private procesarRespuesta(data: ApiResponse): void {
    if (this.estaVacio(data)) {
      this.mostrarSinDatos();
    } else {
      this.procesarDatos(data);

      if (data.idLote) {
        this.idLoteActual = data.idLote;
      }

      this.datosCargados = true;
      setTimeout(() => this.inicializarGrafica(), 100);
    }

    this.isLoading = false;
    this.cdRef.detectChanges();
  }

  private manejarError(error: Error): void {
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

        this.calcularPorcentajesCalidad(datos);

      } else if (datos.estadisticas) {
        this.estadisticas = { ...datos.estadisticas };
        this.calcularPorcentajesCalidad(datos);
      } else {
        this.mostrarSinDatos();
      }
    } catch (error) {
      this.mostrarSinDatos();
    }
  }

  private calcularPorcentajesCalidad(datos: any): void {
    const total = this.estadisticas.totalRegistros || 1;

    if (datos.calidad) {
      this.calidadDatos = { ...datos.calidad };

      this.calidadPorcentajes = {
        alta: total > 0 ? (this.calidadDatos.alta / total) * 100 : 0,
        medio: total > 0 ? (this.calidadDatos.medio / total) * 100 : 0,
        bajo: total > 0 ? (this.calidadDatos.bajo / total) * 100 : 0,
        muyBajo: total > 0 ? (this.calidadDatos.muyBajo / total) * 100 : 0
      };
    } else {
      this.calcularCalidadDesdeTotales(total);
    }
  }

  private calcularCalidadDesdeTotales(total: number): void {
    const revisionMedio = this.estadisticas.revision * 0.5;
    const revisionBajo = this.estadisticas.revision * 0.5;

    this.calidadDatos = {
      alta: this.estadisticas.exactos,
      medio: Math.round(revisionMedio),
      bajo: Math.round(revisionBajo),
      muyBajo: this.estadisticas.fallidos
    };

    this.calidadPorcentajes = {
      alta: total > 0 ? (this.calidadDatos.alta / total) * 100 : 0,
      medio: total > 0 ? (this.calidadDatos.medio / total) * 100 : 0,
      bajo: total > 0 ? (this.calidadDatos.bajo / total) * 100 : 0,
      muyBajo: total > 0 ? (this.calidadDatos.muyBajo / total) * 100 : 0
    };
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
    } catch (error) {}
  }

  private obtenerDatosGrafica() {
    return {
      labels: [
        `Alta (${this.porcentajeAlta.toFixed(1)}%)`,
        `Medio (${this.porcentajeMedio.toFixed(1)}%)`,
        `Bajo (${this.porcentajeBajo.toFixed(1)}%)`,
        `Muy Bajo (${this.porcentajeMuyBajo.toFixed(1)}%)`
      ],
      datasets: [{
        data: [this.porcentajeAlta, this.porcentajeMedio, this.porcentajeBajo, this.porcentajeMuyBajo],
        backgroundColor: this.COLORS,
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 15
      }]
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
      const emptyChart = chartContainer.querySelector('.empty-chart');
      if (!emptyChart) {
        chartContainer.innerHTML = `
          <div class="empty-chart">
            <div class="empty-icon">📊</div>
            <h4>No hay datos para mostrar</h4>
            <p>La base de datos está vacía o no hay registros procesados</p>
          </div>
        `;
      }
    }
  }

  private calcularPorcentaje(valor: number): string {
    if (this.estadisticas.totalRegistros === 0) return '0.0%';
    return ((valor / this.estadisticas.totalRegistros) * 100).toFixed(1) + '%';
  }

  private resetDatos(): void {
    this.estadisticas = { totalRegistros: 0, exactos: 0, revision: 0, fallidos: 0 };
    this.calidadDatos = { alta: 0, medio: 0, bajo: 0, muyBajo: 0 };
    this.calidadPorcentajes = { alta: 0, medio: 0, bajo: 0, muyBajo: 0 };
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
