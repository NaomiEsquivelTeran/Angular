import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DireccionProcesada {
  id_salida: number;
  id_entrada: number;
  direccion_original: string;
  colonia: string;
  alcaldia_municipio: string;
  entidad_federativa: string;
  codigopostal: string;
  latitud: number;
  longitud: number;
  confianza: number;
  confianza_porcentaje?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/todas-direcciones';

  obtenerDirecciones(): Observable<DireccionProcesada[]> {
    return this.http.get<DireccionProcesada[]>(`${this.apiUrl}/direcciones`);
  }

  obtenerEstadisticas(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/estadisticas`);
  }

  eliminarDireccion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/direcciones/${id}`);
  }

  actualizarDireccion(id: number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/direcciones/${id}`, datos);
  }
}
