import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export interface PuntoMapa {
  id: number;
  id_salida?: number;
  direccion_original: string;
  direccion_completa: string;
  colonia: string;
  municipio: string;
  estado: string;
  latitud: number;
  longitud: number;
  confianza: number;
  categoria: string;
  color: string;
  popupContent?: string;
  icono?: string;
  fuente?: string;
  fecha_creacion?: Date;
  codigo_postal?: string;
}

export interface EstadisticasVisor {
  total: number;
  porCategoria: {
    alto: number;
    medio: number;
    bajo: number;
    muyBajo: number;
  };
  calidadPromedio: number;
  totalEnBD?: number;
  obtenidos?: number;
}

export interface FiltrosVisor {
  calidad_minima?: number;
  calidad_maxima?: number;
  municipio?: string;
  estado?: string;
  colonia?: string;
  limite?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodificadorService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  obtenerCoordenadasVisor(filtros: FiltrosVisor = {}): Observable<any> {
    let params = new HttpParams();

    if (filtros.calidad_minima !== undefined && filtros.calidad_minima !== null) {
      params = params.set('calidad_minima', filtros.calidad_minima.toString());
    } else {
      params = params.set('calidad_minima', '0');
    }

    if (filtros.calidad_maxima !== undefined && filtros.calidad_maxima !== null) {
      params = params.set('calidad_maxima', filtros.calidad_maxima.toString());
    } else {
      params = params.set('calidad_maxima', '100');
    }

    if (filtros.municipio && filtros.municipio.trim() !== '') {
      params = params.set('municipio', filtros.municipio.trim());
    }

    if (filtros.estado && filtros.estado.trim() !== '') {
      params = params.set('estado', filtros.estado.trim());
    }

    if (filtros.colonia && filtros.colonia.trim() !== '') {
      params = params.set('colonia', filtros.colonia.trim());
    }

    if (filtros.limite && filtros.limite > 0) {
      params = params.set('limite', filtros.limite.toString());
    }

    const url = `${this.apiUrl}/visor/coordenadas`;

    return this.http.get<any>(url, { params })
      .pipe(
        timeout(120000),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  buscarDirecciones(termino: string): Observable<any> {
    if (!termino || termino.length < 3) {
      return throwError(() => new Error('El término debe tener al menos 3 caracteres'));
    }

    return this.http.get<any>(`${this.apiUrl}/visor/buscar-mapa`, {
      params: { termino }
    }).pipe(
      timeout(30000),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  obtenerEstadisticasCalidad(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/visor/estadisticas-calidad`)
      .pipe(
        timeout(30000),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  obtenerTodasCoordenadas(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/visor/coordenadas`)
      .pipe(
        timeout(120000),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }
}
