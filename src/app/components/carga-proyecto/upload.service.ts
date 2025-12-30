import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { catchError, switchMap, takeWhile } from 'rxjs/operators';

export interface UploadResponse {
  success?: boolean;
  message?: string;
  mensaje?: string;
  sessionId?: string;
  fileName?: string;
  progressUrl?: string;
  totalRegistros?: number;
  registrosProcesados?: number;
  total?: number;
  id_lote?: number;
  eficiencia?: string;
  velocidad?: string;
  tiempoTotal?: string;
  error?: string;
  detalle?: string;
}

export interface ProgresoUpload {
  progreso: number;
  mensaje: string;
  registrosProcesados?: number;
  totalRegistros?: number;
  tipo?: 'uploading' | 'parsing' | 'normalizing' | 'geocoding' | 'saving' | 'complete' | 'error';
  sessionId?: string | null;
  fileName?: string;
  status?: string;
  details?: {
    elapsedTime?: string;
    estimatedTimeRemaining?: string;
    speed?: string;
    currentOperation?: string;
  };
  isComplete?: boolean;
  hasError?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private apiUrl = 'http://localhost:3000/api';
  private progresoSubject = new BehaviorSubject<ProgresoUpload>({
    progreso: 0,
    mensaje: 'Preparando...',
    tipo: 'uploading'
  });
  private pollSubscription: Subscription | null = null;
  private currentSessionId: string | null = null;

  progreso$ = this.progresoSubject.asObservable();

  constructor(private http: HttpClient) {}

  subirArchivo(archivo: File, proyectoNombre: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    if (proyectoNombre) {
      formData.append('nombreProyecto', proyectoNombre);
    }

    this.progresoSubject.next({
      progreso: 0,
      mensaje: 'Iniciando carga del archivo...',
      tipo: 'uploading'
    });

    return new Observable<UploadResponse>(observer => {
      this.http.post(`${this.apiUrl}/subir-con-progreso`, formData)
        .pipe(
          catchError(error => {
            this.progresoSubject.next({
              progreso: 0,
              mensaje: `Error: ${error.message || 'Error al iniciar carga'}`,
              tipo: 'error'
            });
            observer.error(error);
            return [];
          })
        )
        .subscribe({
          next: (respuestaInicial: any) => {
            if (respuestaInicial.sessionId) {
              this.currentSessionId = respuestaInicial.sessionId;

              this.progresoSubject.next({
                progreso: 0,
                mensaje: 'Archivo recibido, procesamiento iniciado',
                sessionId: this.currentSessionId,
                fileName: respuestaInicial.fileName,
                tipo: 'uploading'
              });

              observer.next({
                success: true,
                message: respuestaInicial.message,
                sessionId: respuestaInicial.sessionId,
                fileName: respuestaInicial.fileName,
                progressUrl: respuestaInicial.progressUrl
              });

              if (this.currentSessionId) {
                this.iniciarMonitoreoProgreso(this.currentSessionId, observer);
              } else {
                observer.error({ error: 'SessionId es null' });
              }
            } else {
              observer.error({ error: 'No se recibió sessionId del servidor' });
            }
          },
          error: (error) => {
            this.progresoSubject.next({
              progreso: 0,
              mensaje: `Error: ${error.message || 'Error de conexión'}`,
              tipo: 'error'
            });
            observer.error(error);
          }
        });
    });
  }

  private iniciarMonitoreoProgreso(sessionId: string, observer: any) {
    this.pollSubscription = interval(1000)
      .pipe(
        switchMap(() => this.obtenerProgreso(sessionId)),
        takeWhile((progreso: ProgresoUpload) => {
          return !progreso.isComplete && !progreso.hasError;
        }, true)
      )
      .subscribe({
        next: (progreso: ProgresoUpload) => {
          this.progresoSubject.next(progreso);

          if (progreso.isComplete) {
            this.detenerMonitoreo();

            const resultadoFinal: UploadResponse = {
              success: true,
              message: progreso.mensaje || 'Proceso completado exitosamente',
              totalRegistros: progreso.totalRegistros || 0,
              registrosProcesados: progreso.registrosProcesados || progreso.totalRegistros || 0
            };

            observer.next(resultadoFinal);
            observer.complete();
          }

          if (progreso.hasError) {
            this.detenerMonitoreo();
            observer.error({ error: progreso.mensaje });
          }
        },
        error: (error) => {
          this.detenerMonitoreo();
          observer.error(error);
        }
      });
  }

  private obtenerProgreso(sessionId: string): Observable<ProgresoUpload> {
    return new Observable<ProgresoUpload>(observer => {
      this.http.get(`${this.apiUrl}/progreso/${sessionId}`)
        .pipe(
          catchError(error => {
            observer.next({
              progreso: 0,
              mensaje: `Error obteniendo progreso: ${error.message}`,
              hasError: true,
              tipo: 'error'
            });
            observer.complete();
            return [];
          })
        )
        .subscribe({
          next: (respuesta: any) => {
            if (respuesta.success && respuesta.progress) {
              const progress = respuesta.progress;
              observer.next({
                progreso: progress.percentage || 0,
                mensaje: progress.message || 'Procesando...',
                registrosProcesados: progress.details?.processedRecords || 0,
                totalRegistros: progress.details?.totalRecords || 0,
                sessionId: progress.sessionId || null,
                fileName: progress.fileName,
                status: progress.status,
                tipo: this.mapStatusToType(progress.status),
                details: {
                  elapsedTime: progress.details?.elapsedTime,
                  estimatedTimeRemaining: progress.details?.estimatedTimeRemaining,
                  speed: progress.details?.speed,
                  currentOperation: progress.details?.currentOperation
                },
                isComplete: progress.isComplete || false,
                hasError: progress.hasError || false
              });
            } else {
              observer.next({
                progreso: 0,
                mensaje: respuesta.error || 'Error en respuesta del progreso',
                hasError: true,
                tipo: 'error'
              });
            }
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  private mapStatusToType(status: string): 'uploading' | 'parsing' | 'normalizing' | 'geocoding' | 'saving' | 'complete' | 'error' {
    switch (status) {
      case 'uploading': return 'uploading';
      case 'parsing': return 'parsing';
      case 'normalizing': return 'normalizing';
      case 'geocoding': return 'geocoding';
      case 'saving': return 'saving';
      case 'complete': return 'complete';
      case 'error': return 'error';
      default: return 'uploading';
    }
  }

  cancelarProcesamiento(sessionId: string): Observable<any> {
    return new Observable(observer => {
      this.http.delete(`${this.apiUrl}/progreso/${sessionId}/cancelar`)
        .subscribe({
          next: (respuesta: any) => {
            this.detenerMonitoreo();
            observer.next(respuesta);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
    });
  }

  private detenerMonitoreo() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = null;
    }
  }

  limpiarProgreso() {
    this.detenerMonitoreo();
    this.currentSessionId = null;
    this.progresoSubject.next({
      progreso: 0,
      mensaje: 'Preparando...',
      tipo: 'uploading'
    });
  }
}
