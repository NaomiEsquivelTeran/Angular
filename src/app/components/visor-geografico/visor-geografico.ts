import { Component, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GeocodificadorService, PuntoMapa, EstadisticasVisor, FiltrosVisor } from './visor.service';

declare global {
  interface Window {
    L: any;
  }
}

@Component({
  selector: 'app-visor-geografico',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './visor-geografico.html',
  styleUrls: ['./visor-geografico.css']
})
export class VisorGeograficoComponent implements AfterViewInit, OnInit, OnDestroy {
  map: any = null;
  isLoading = true;
  leafletLoaded = false;

  markers: any[] = [];
  puntos: PuntoMapa[] = [];
  estadisticas: EstadisticasVisor | null = null;

  porcentajesFiltros = {
    alto: 0,
    medio: 0,
    bajo: 0,
    muyBajo: 0
  };

  filtros = [
    { nivel: 'Alto', rango: '80-100%', cantidad: 0, porcentaje: 0, color: '#27ae60', activo: true, min: 80, max: 100 },
    { nivel: 'Medio', rango: '50-79%', cantidad: 0, porcentaje: 0, color: '#f39c12', activo: true, min: 50, max: 79 },
    { nivel: 'Bajo', rango: '20-49%', cantidad: 0, porcentaje: 0, color: '#e74c3c', activo: true, min: 20, max: 49 },
    { nivel: 'Muy Bajo', rango: '0-19%', cantidad: 0, porcentaje: 0, color: '#c0392b', activo: true, min: 0, max: 19 }
  ];

  filtrosAplicados: FiltrosVisor = {
    calidad_minima: 0,
    calidad_maxima: 100
  };

  terminoBusqueda = '';
  buscando = false;
  centroMapa = [21.125, -101.686];
  zoomInicial = 13;

  constructor(
    private geocodificadorService: GeocodificadorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.checkLeaflet();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.markers = [];
  }

  checkLeaflet(): void {
    if (typeof window.L !== 'undefined') {
      this.leafletLoaded = true;
      this.initMap();
      return;
    }
    this.loadLeafletManually();
  }

  loadLeafletManually(): void {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

    script.onload = () => {
      this.leafletLoaded = true;
      this.initMap();
    };

    script.onerror = () => {
      this.showMapError('No se pudo cargar la biblioteca de mapas.');
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    };

    document.head.appendChild(script);
  }

  initMap(): void {
    const mapElement = document.getElementById('mapContainer');
    if (!mapElement) {
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return;
    }

    if (typeof window.L === 'undefined') {
      this.showMapError('La biblioteca de mapas no está disponible.');
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return;
    }

    const L = window.L;

    try {
      this.map = L.map('mapContainer').setView(this.centroMapa, this.zoomInicial);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(this.map);

      L.control.scale().addTo(this.map);

      this.cargarDatosReales();

      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 300);

    } catch (error: any) {
      this.showMapError(`Error: ${error.message}`);
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  recalcularFiltrosParaBackend(): void {
    const filtrosActivos = this.filtros.filter(f => f.activo);

    if (filtrosActivos.length === 0) {
      this.filtrosAplicados = {
        calidad_minima: undefined,
        calidad_maxima: undefined
      };
    } else if (filtrosActivos.length === this.filtros.length) {
      this.filtrosAplicados = {
        calidad_minima: undefined,
        calidad_maxima: undefined
      };
    } else {
      const minValues = filtrosActivos.map(f => f.min);
      const maxValues = filtrosActivos.map(f => f.max);

      const calidadMinima = Math.min(...minValues);
      const calidadMaxima = Math.max(...maxValues);

      this.filtrosAplicados = {
        calidad_minima: calidadMinima,
        calidad_maxima: calidadMaxima
      };
    }

    this.cargarDatosReales();
  }

  cargarDatosReales(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.puntos = [];
    this.estadisticas = null;

    this.geocodificadorService.obtenerCoordenadasVisor(this.filtrosAplicados)
      .subscribe({
        next: (response) => {
          if (response.success && response.puntos && response.puntos.length > 0) {
            this.puntos = response.puntos;
            this.estadisticas = response.estadisticas;

            this.actualizarEstadisticasFiltros();
            this.agregarMarcadoresReales();

            if (this.puntos.length > 0 && this.map) {
              this.ajustarVistaMapa();
            }

          } else {
            this.mostrarMensajeSinDatos();
          }

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          let mensajeError = 'Error al cargar los datos del servidor';

          if (error.status === 408) {
            mensajeError = 'La consulta tardó demasiado. Intenta con filtros más específicos.';
          } else if (error.status === 404) {
            mensajeError = 'Endpoint no encontrado. Verifica que la ruta sea correcta.';
          } else if (error.status === 500) {
            mensajeError = 'Error interno del servidor. Verifica que el backend esté funcionando.';
          } else if (error.status === 0) {
            mensajeError = 'No se puede conectar al servidor. Verifica que el backend esté corriendo en http://localhost:3000';
          }

          this.mostrarErrorEnMapa(mensajeError, error.error?.detalle || error.message || 'Sin detalles');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  ajustarVistaMapa(): void {
    if (!this.map || this.puntos.length === 0) return;

    const L = window.L;

    try {
      if (this.puntos.length === 1) {
        const punto = this.puntos[0];
        this.map.setView([punto.latitud, punto.longitud], 15);
      } else if (this.puntos.length > 1 && this.puntos.length <= 100) {
        const bounds = L.latLngBounds(this.puntos.map(p => [p.latitud, p.longitud]));
        this.map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        const primerPunto = this.puntos[0];
        this.map.setView([primerPunto.latitud, primerPunto.longitud], this.zoomInicial);
      }
    } catch (error) {}
  }

  mostrarMensajeSinDatos(): void {
    if (this.map) {
      const L = window.L;
      L.popup()
        .setLatLng(this.centroMapa)
        .setContent(`
          <div style="padding: 20px; text-align: center; max-width: 300px;">
            <div style="font-size: 40px; margin-bottom: 10px;">📭</div>
            <h3 style="color: #3498db; margin: 0 0 10px 0;">Sin datos para mostrar</h3>
            <p style="margin: 0; color: #666;">
              No se encontraron coordenadas con los filtros actuales.
            </p>
          </div>
        `)
        .openOn(this.map);
    }
  }

  mostrarErrorEnMapa(titulo: string, mensaje: string): void {
    if (this.map) {
      const L = window.L;
      L.popup()
        .setLatLng(this.centroMapa)
        .setContent(`
          <div style="padding: 15px; text-align: center; max-width: 300px;">
            <h3 style="color: #e74c3c; margin-bottom: 10px;">⚠️ ${titulo}</h3>
            <p style="margin: 0 0 10px 0; color: #666;">${mensaje}</p>
          </div>
        `)
        .openOn(this.map);
    }
  }

  actualizarEstadisticasFiltros(): void {
    if (!this.estadisticas) {
      return;
    }

    const totalEstadisticas = this.estadisticas.total;

    if (totalEstadisticas > 0) {
      const porCategoria = this.estadisticas.porCategoria || {};

      this.porcentajesFiltros = {
        alto: Math.round((porCategoria.alto / totalEstadisticas) * 100 * 10) / 10,
        medio: Math.round((porCategoria.medio / totalEstadisticas) * 100 * 10) / 10,
        bajo: Math.round((porCategoria.bajo / totalEstadisticas) * 100 * 10) / 10,
        muyBajo: Math.round((porCategoria.muyBajo / totalEstadisticas) * 100 * 10) / 10
      };

      this.filtros.forEach(filtro => {
        switch(filtro.nivel) {
          case 'Alto':
            filtro.cantidad = porCategoria.alto || 0;
            filtro.porcentaje = this.porcentajesFiltros.alto;
            break;
          case 'Medio':
            filtro.cantidad = porCategoria.medio || 0;
            filtro.porcentaje = this.porcentajesFiltros.medio;
            break;
          case 'Bajo':
            filtro.cantidad = porCategoria.bajo || 0;
            filtro.porcentaje = this.porcentajesFiltros.bajo;
            break;
          case 'Muy Bajo':
            filtro.cantidad = porCategoria.muyBajo || 0;
            filtro.porcentaje = this.porcentajesFiltros.muyBajo;
            break;
        }
      });
    } else {
      this.filtros.forEach(filtro => {
        filtro.cantidad = 0;
        filtro.porcentaje = 0;
      });
    }
  }

  agregarMarcadoresReales(): void {
    if (!this.map || !this.puntos.length) {
      return;
    }

    const L = window.L;
    this.limpiarMarcadores();

    this.puntos.forEach((punto) => {
      if (!this.cumpleFiltros(punto)) {
        return;
      }

      const customIcon = L.divIcon({
        html: `<div style="
          width: 14px;
          height: 14px;
          background-color: ${punto.color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        "></div>`,
        iconSize: [14, 14],
        className: 'custom-marker'
      });

      const marker = L.marker([punto.latitud, punto.longitud], {
        icon: customIcon,
        title: punto.direccion_original || 'Sin dirección'
      })
      .addTo(this.map)
      .bindPopup(`
        <div style="min-width: 280px; font-family: 'Segoe UI', Arial, sans-serif; padding: 12px;">
          <div style="background: ${punto.color}; color: white; padding: 8px 12px; border-radius: 4px 4px 0 0; margin: -12px -12px 12px -12px;">
            <strong>📍 ${punto.confianza}%</strong>
          </div>
          <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            ${punto.direccion_original ? punto.direccion_original.substring(0, 40) + (punto.direccion_original.length > 40 ? '...' : '') : 'Sin dirección'}
          </h3>
          <div style="margin: 10px 0;">
            <p style="margin: 5px 0;"><strong>📍 Dirección:</strong><br>
              ${punto.direccion_completa || 'N/A'}
            </p>
            <p style="margin: 5px 0;"><strong>🏙️ Ubicación:</strong><br>
              ${punto.colonia || ''}, ${punto.municipio || ''}, ${punto.estado || ''}
            </p>
            <p style="margin: 5px 0;"><strong>🎯 Calidad:</strong>
              <span style="color: ${punto.color}; font-weight: bold;">${punto.categoria} (${punto.confianza}%)</span>
            </p>
            ${punto.id_salida ? `<p style="margin: 5px 0;"><strong>🆔 ID:</strong> ${punto.id_salida}</p>` : ''}
            <p style="margin: 5px 0;"><strong>📍 Coordenadas:</strong><br>
              Lat: ${punto.latitud.toFixed(6)}<br>
              Lng: ${punto.longitud.toFixed(6)}
            </p>
          </div>
        </div>
      `);

      this.markers.push(marker);
    });
  }

  cumpleFiltros(punto: PuntoMapa): boolean {
    return this.filtros.some(f =>
      f.activo &&
      punto.confianza >= f.min &&
      punto.confianza <= f.max
    );
  }

  limpiarMarcadores(): void {
    if (this.markers.length > 0) {
      this.markers.forEach(marker => {
        if (this.map && marker) {
          this.map.removeLayer(marker);
        }
      });
      this.markers = [];
    }
  }

  alternarFiltro(nivel: string): void {
    const filtro = this.filtros.find(f => f.nivel === nivel);
    if (filtro) {
      filtro.activo = !filtro.activo;
      this.recalcularFiltrosParaBackend();
    }
  }

  estaFiltroActivo(nivel: string): boolean {
    const filtro = this.filtros.find(f => f.nivel === nivel);
    return filtro ? filtro.activo : false;
  }

  seleccionarTodos(): void {
    this.filtros.forEach(filtro => {
      filtro.activo = true;
    });
    this.recalcularFiltrosParaBackend();
  }

  deseleccionarTodos(): void {
    this.filtros.forEach(filtro => {
      filtro.activo = false;
    });
    this.recalcularFiltrosParaBackend();
  }

  limpiarFiltrosCompletamente(): void {
    this.filtros.forEach(filtro => {
      filtro.activo = true;
    });

    this.filtrosAplicados = {
      calidad_minima: undefined,
      calidad_maxima: undefined
    };

    this.cargarDatosReales();
  }

  actualizarMapaSegunFiltros(): void {
    this.recalcularFiltrosParaBackend();
  }

  buscarDirecciones(): void {
    if (!this.terminoBusqueda || this.terminoBusqueda.length < 3) {
      return;
    }

    this.buscando = true;
    this.cdr.detectChanges();

    this.geocodificadorService.buscarDirecciones(this.terminoBusqueda)
      .subscribe({
        next: (response) => {
          this.buscando = false;

          if (response.success && response.resultados && response.resultados.length > 0) {
            this.limpiarMarcadores();

            const L = window.L;
            response.resultados.forEach((punto: PuntoMapa) => {
              const customIcon = L.divIcon({
                html: `<div style="
                  width: 20px;
                  height: 20px;
                  background-color: ${punto.color};
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                  cursor: pointer;
                "></div>`,
                iconSize: [20, 20],
                className: 'custom-marker-busqueda'
              });

              const marker = L.marker([punto.latitud, punto.longitud], {
                icon: customIcon,
                title: `Búsqueda: ${punto.direccion_original}`
              })
              .addTo(this.map)
              .bindPopup(`
                <div style="min-width: 250px; font-family: Arial, sans-serif; padding: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                    🔍 ${punto.direccion_original.substring(0, 30)}${punto.direccion_original.length > 30 ? '...' : ''}
                  </h3>
                  <div style="margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>📍 Dirección:</strong><br>
                      ${punto.direccion_completa}
                    </p>
                    <p style="margin: 5px 0;"><strong>🏙️ Ubicación:</strong><br>
                      ${punto.colonia}, ${punto.municipio}, ${punto.estado}
                    </p>
                    <p style="margin: 5px 0;"><strong>🎯 Calidad:</strong>
                      <span style="color: ${punto.color}; font-weight: bold;">${punto.categoria} (${punto.confianza}%)</span>
                    </p>
                  </div>
                </div>
              `);

              this.markers.push(marker);
            });

            const primerResultado = response.resultados[0];
            this.map.setView([primerResultado.latitud, primerResultado.longitud], 15);

          } else {
            if (this.map) {
              const L = window.L;
              L.popup()
                .setLatLng(this.map.getCenter())
                .setContent(`
                  <div style="padding: 15px; text-align: center;">
                    <h3 style="color: #f39c12; margin-bottom: 10px;">🔍 No se encontraron resultados</h3>
                    <p>No hay direcciones que coincidan con: "${this.terminoBusqueda}"</p>
                  </div>
                `)
                .openOn(this.map);
            }
          }

          this.cdr.detectChanges();
        },
        error: (error) => {
          this.buscando = false;
          this.cdr.detectChanges();
        }
      });
  }

  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.buscando = false;
    this.limpiarMarcadores();
    this.agregarMarcadoresReales();
    this.cdr.detectChanges();
  }

  showMapError(message: string): void {
    const mapElement = document.getElementById('mapContainer');
    if (mapElement) {
      mapElement.innerHTML = `
        <div style="
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #1a1a2e;
          color: white;
          padding: 30px;
          text-align: center;
          font-family: Arial, sans-serif;
        ">
          <div style="font-size: 60px; margin-bottom: 20px;">🗺️</div>
          <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #3498db;">Visor Geográfico</h2>
          <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #e74c3c;">⚠️ Problema con el mapa</h3>
            <p style="margin: 0 0 15px 0; color: #ecf0f1;">${message}</p>
          </div>
          <button onclick="location.reload()"
                  style="margin-top: 20px; padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">
            🔄 Recargar página
          </button>
        </div>
      `;
    }
  }
}
