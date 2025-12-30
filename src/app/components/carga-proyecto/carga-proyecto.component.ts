import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UploadService, ProgresoUpload, UploadResponse } from './upload.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-carga-proyecto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carga-proyecto.component.html',
  styleUrls: ['./carga-proyecto.component.css']
})
export class CargaProyectoComponent implements OnInit, OnDestroy {
  archivoCSV: File | null = null;
  cargando: boolean = false;
  error: string | null = null;

  progreso: number = 0;
  mensajeEstado: string = 'Preparando...';
  registrosProcesados: number = 0;
  totalRegistros: number = 0;
  tiempoProcesamiento: string = '0s';
  tipoProceso: string = 'uploading';

  estaCompletado: boolean = false;
  eficiencia: string = '';
  velocidad: string = '';
  idLote: number | null = null;

  private uploadSubscription: Subscription | null = null;
  private progresoSubscription: Subscription | null = null;

  constructor(
    private uploadService: UploadService,
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.progresoSubscription = this.uploadService.progreso$.subscribe({
      next: (progresoData: ProgresoUpload) => {
        this.progreso = progresoData.progreso;
        this.mensajeEstado = progresoData.mensaje;
        this.registrosProcesados = progresoData.registrosProcesados || 0;
        this.totalRegistros = progresoData.totalRegistros || 0;
        this.tipoProceso = progresoData.tipo || 'uploading';

        if (progresoData.details?.elapsedTime) {
          this.tiempoProcesamiento = progresoData.details.elapsedTime;
        }

        if (progresoData.isComplete) {
          this.cargando = false;
          this.estaCompletado = true;
        }

        if (progresoData.hasError) {
          this.cargando = false;
          this.error = progresoData.mensaje;
        }

        this.cdRef.detectChanges();
      },
      error: (error) => {
        this.cargando = false;
        this.error = 'Error en la comunicación con el servidor';
        this.cdRef.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
    }
    if (this.progresoSubscription) {
      this.progresoSubscription.unsubscribe();
    }
    this.uploadService.limpiarProgreso();
  }

  prevenirComportamientoPredeterminado(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onArrastrarSoltar(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files) {
      this.seleccionarArchivo(event.dataTransfer.files[0]);
    }
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.seleccionarArchivo(input.files[0]);
    }
  }

  seleccionarArchivo(archivo: File) {
    if (archivo && archivo.name.toLowerCase().endsWith('.csv')) {
      this.archivoCSV = archivo;
      this.error = null;
    } else {
      this.error = 'Por favor selecciona un archivo CSV válido';
    }
  }

  procesarArchivo() {
    if (!this.archivoCSV) return;

    this.cargando = true;
    this.error = null;
    this.estaCompletado = false;

    this.progreso = 0;
    this.registrosProcesados = 0;
    this.totalRegistros = 0;
    this.tiempoProcesamiento = '0s';

    this.uploadSubscription = this.uploadService.subirArchivo(this.archivoCSV, '').subscribe({
      next: (respuesta: UploadResponse) => {
        this.eficiencia = respuesta.eficiencia || '';
        this.velocidad = respuesta.velocidad || '';
        this.idLote = respuesta.id_lote || null;

        if (!respuesta.success) {
          this.cargando = false;
          this.error = respuesta.error || 'Error desconocido en el procesamiento';
        }
        this.cdRef.detectChanges();
      },
      error: (error) => {
        this.cargando = false;
        this.error = error.error?.error || error.message || 'Error al procesar el archivo';
        this.cdRef.detectChanges();
      }
    });
  }

  cancelarProcesamiento() {
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
    }
    this.uploadService.limpiarProgreso();
    this.cargando = false;
    this.cdRef.detectChanges();
  }

  cancelarCarga() {
    this.cancelarProcesamiento();
    this.archivoCSV = null;
    this.estaCompletado = false;
    this.error = null;
    this.cdRef.detectChanges();
  }

  descargarResultados() {
    if (this.idLote) {
    }
  }

  reintentarCarga() {
    if (this.archivoCSV) {
      this.error = null;
      this.procesarArchivo();
    }
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
