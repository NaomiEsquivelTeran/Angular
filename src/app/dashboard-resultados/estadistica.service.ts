import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class EstadisticaService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/consultas/estadisticas/dashboard';

  obtenerDashboard(): Observable<any> {
    return this.http.get<any>(this.apiUrl).pipe(
      catchError(error => {
        return throwError(() => new Error('No se pudo conectar con el servidor'));
      })
    );
  }
}
