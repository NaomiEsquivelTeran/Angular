import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DirectionService {
  private apiUrl = 'http://localhost:3000/api/consultas/todas-direcciones';
  private deleteUrl = 'http://localhost:3000/api/direcciones/salida';

  constructor(private http: HttpClient) {}

  obtenerTodasDirecciones(): Observable<any[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      timeout(15000),
      retry(1),
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.datos && Array.isArray(response.datos)) {
          return response.datos;
        } else if (response && response.data && Array.isArray(response.data)) {
          return response.data;
        } else {
          return [];
        }
      }),
      catchError((error: any) => {
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

  eliminarDireccion(id: number): Observable<any> {
    const url = `${this.deleteUrl}/${id}`;

    return this.http.delete(url).pipe(
      timeout(10000),
      catchError((error: any) => {
        let mensajeError = 'Error al eliminar el registro';

        if (error.name === 'TimeoutError') {
          mensajeError = 'El servidor no respondió al intentar eliminar';
        } else if (error.status === 0) {
          mensajeError = 'No se puede conectar al servidor';
        } else if (error.status === 404) {
          mensajeError = 'El registro no existe';
        } else if (error.status) {
          mensajeError = `Error ${error.status}: ${error.message}`;
        }

        return throwError(() => new Error(mensajeError));
      })
    );
  }
}
