import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout, retry, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DirectionService {
  private apiUrl = 'http://localhost:3000/api/consultas/todas-direcciones';

  constructor(private http: HttpClient) {}

  obtenerTodasDirecciones(): Observable<any[]> {
    console.log('🔍 [Service] Llamando a API:', this.apiUrl);

    return this.http.get<any>(this.apiUrl).pipe(
      timeout(15000),
      retry(1),

      tap({
        next: (response) => console.log('[Service] Respuesta recibida'),
        error: (error) => console.error('[Service] Error:', error)
      }),

      map((response) => {
        // Extraer datos de diferentes estructuras posibles
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.datos && Array.isArray(response.datos)) {
          return response.datos;
        } else if (response && response.data && Array.isArray(response.data)) {
          return response.data;
        } else {
          console.warn('[Service] Estructura no reconocida, retornando array vacío');
          return [];
        }
      }),

      catchError((error: any) => {
        console.error('[Service] Error en solicitud:', error);

        let mensajeError = 'Error desconocido';
        if (error.name === 'TimeoutError') {
          mensajeError = 'El servidor no respondió en 15 segundos';
        } else if (error.status === 0) {
          mensajeError = 'No se puede conectar al servidor';
        } else if (error.status) {
          mensajeError = `Error ${error.status}: ${error.message}`;
        }

        return throwError(() => new Error(mensajeError));
      })
    );
  }
}
