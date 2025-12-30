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

@Injectable({
  providedIn: 'root'
})
export class GeocodificadorService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  // CORREGIDO: Función principal para obtener coordenadas con parámetros corregidos
  obtenerCoordenadasVisor(filtros: any = {}): Observable<any> {
    // Crear HttpParams con los nombres correctos que espera el backend
    let params = new HttpParams();

    // Usar calidad_minima (no cal._) - este es el nombre que tu backend espera
    if (filtros.calidad_minima !== undefined && filtros.calidad_minima !== null) {
      params = params.set('calidad_minima', filtros.calidad_minima.toString());
    } else {
      params = params.set('calidad_minima', '0'); // Valor por defecto
    }

    if (filtros.calidad_maxima !== undefined && filtros.calidad_maxima !== null) {
      params = params.set('calidad_maxima', filtros.calidad_maxima.toString());
    } else {
      params = params.set('calidad_maxima', '100'); // Valor por defecto
    }

    if (filtros.municipio) {
      params = params.set('municipio', filtros.municipio);
    }

    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }

    if (filtros.colonia) {
      params = params.set('colonia', filtros.colonia);
    }

    // Limitar solo si se especifica explícitamente
    if (filtros.limite && filtros.limite > 0) {
      params = params.set('limite', filtros.limite.toString());
    }

    // Para diagnóstico, mostrar la URL que se está llamando
    const url = `${this.apiUrl}/visor/coordenadas`;
    console.log('🔍 Llamando al backend:', url);
    console.log('📤 Parámetros:', params.toString());

    // URL CORREGIDA: /visor/coordenadas en lugar de /geocodificador/vison
    return this.http.get<any>(url, { params })
      .pipe(
        timeout(120000), // Aumentado a 2 minutos para grandes consultas
        catchError(error => {
          console.error('❌ Error en servicio de coordenadas:', error);
          return throwError(() => error);
        })
      );
  }

  // CORREGIDO: Esta ruta debe ser /visor/buscar-mapa según tu backend
  buscarDirecciones(termino: string): Observable<any> {
    if (!termino || termino.length < 3) {
      return throwError(() => new Error('El término debe tener al menos 3 caracteres'));
    }

    // URL CORREGIDA: /visor/buscar-mapa
    return this.http.get<any>(`${this.apiUrl}/visor/buscar-mapa`, {
      params: { termino }
    }).pipe(
      timeout(30000),
      catchError(error => {
        console.error('Error buscando direcciones:', error);
        return throwError(() => error);
      })
    );
  }

  // CORREGIDO: Esta ruta debe ser /visor/estadisticas-calidad
  obtenerEstadisticasCalidad(): Observable<any> {
    // URL CORREGIDA: /visor/estadisticas-calidad
    return this.http.get<any>(`${this.apiUrl}/visor/estadisticas-calidad`)
      .pipe(
        timeout(30000),
        catchError(error => {
          console.error('Error obteniendo estadísticas:', error);
          return throwError(() => error);
        })
      );
  }

  // Método para diagnóstico
  obtenerTodasCoordenadas(): Observable<any> {
    const params = new HttpParams()
      .set('calidad_minima', '0')
      .set('calidad_maxima', '100');

    return this.http.get<any>(`${this.apiUrl}/visor/coordenadas`, { params })
      .pipe(
        timeout(120000),
        catchError(error => {
          console.error('Error diagnóstico:', error);
          return throwError(() => error);
        })
      );
  }
}
