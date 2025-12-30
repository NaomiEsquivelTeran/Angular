import { Component, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GeocodificadorService, PuntoMapa, EstadisticasVisor } from './visor.service';

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
  // Variables del mapa
  map: any = null;
  isLoading = true;
  leafletLoaded = false;

  // Marcadores en el mapa
  markers: any[] = [];

  // Datos reales del servidor
  puntos: PuntoMapa[] = [];
  estadisticas: EstadisticasVisor | null = null;

  // Filtros dinámicos basados en datos reales
// En visor-geografico.ts, actualiza el array filtros:
filtros = [
  { nivel: 'Alto', rango: '80-100%', cantidad: 0, color: '#27ae60', activo: true, min: 80, max: 100 },
  { nivel: 'Medio', rango: '50-79%', cantidad: 0, color: '#f39c12', activo: true, min: 50, max: 79 },
  { nivel: 'Bajo', rango: '20-49%', cantidad: 0, color: '#e74c3c', activo: true, min: 20, max: 49 },
  { nivel: 'Muy Bajo', rango: '0-19%', cantidad: 0, color: '#c0392b', activo: true, min: 0, max: 19 }
];

  // MODIFICADO: Nombres de parámetros CORRECTOS para el backend
  filtrosAplicados = {
    calidad_minima: 0,    // CORRECTO: el backend espera 'calidad_minima' no 'cal._'
    calidad_maxima: 100,  // CORRECTO
    municipio: '',
    estado: '',
    colonia: ''
    // NO incluir 'limite' para traer TODOS los datos
  };

  // Búsqueda
  terminoBusqueda = '';
  buscando = false;

  // Centro inicial
  centroMapa = [21.125, -101.686]; // León, Guanajuato
  zoomInicial = 13;

  constructor(
    private geocodificadorService: GeocodificadorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('✅ Componente visor-geografico inicializado');
  }

  ngAfterViewInit(): void {
    console.log('🗺️ Iniciando carga del mapa...');
    setTimeout(() => {
      this.checkLeaflet();
    }, 0);
  }

  ngOnDestroy(): void {
    // Limpiar mapa al destruir componente
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.markers = [];
  }

  checkLeaflet(): void {
    if (typeof window.L !== 'undefined') {
      console.log('✅ Leaflet ya está disponible');
      this.leafletLoaded = true;
      this.initMap();
      return;
    }

    console.log('⚠️ Leaflet no está disponible, cargando manualmente...');
    this.loadLeafletManually();
  }

  loadLeafletManually(): void {
    console.log('📥 Cargando Leaflet manualmente...');

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

    script.onload = () => {
      console.log('✅ Leaflet cargado manualmente');
      this.leafletLoaded = true;
      this.initMap();
    };

    script.onerror = () => {
      console.error('❌ Error al cargar Leaflet manualmente');
      this.showMapError('No se pudo cargar la biblioteca de mapas.');
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    };

    document.head.appendChild(script);
  }

  initMap(): void {
    console.log('🗺️ Inicializando mapa...');

    const mapElement = document.getElementById('mapContainer');
    if (!mapElement) {
      console.error('❌ Elemento del mapa no encontrado');
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return;
    }

    if (typeof window.L === 'undefined') {
      console.error('❌ Leaflet no está disponible para crear el mapa');
      this.showMapError('La biblioteca de mapas no está disponible.');
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
      return;
    }

    const L = window.L;

    try {
      console.log('🌍 Creando mapa con Leaflet...');
      this.map = L.map('mapContainer').setView(this.centroMapa, this.zoomInicial);
      console.log('✅ Mapa creado');

      // Capa base de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(this.map);
      console.log('✅ Capa de mapa agregada');

      // Agregar escala
      L.control.scale().addTo(this.map);

      // Cargar datos reales del servidor (TODOS)
      this.cargarDatosReales();

      // Ajustar tamaño del mapa
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          console.log('✅ Tamaño del mapa actualizado');
        }
      }, 300);

      console.log('✅ Mapa completamente inicializado');

    } catch (error: any) {
      console.error('❌ Error al crear el mapa:', error);
      this.showMapError(`Error: ${error.message}`);
      setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  cargarDatosReales(): void {
    console.log('📊 Cargando TODOS los datos del servidor...');
    console.log('📤 Enviando filtros:', this.filtrosAplicados);

    // Mostrar loading
    this.isLoading = true;
    this.cdr.detectChanges();

    // Limpiar puntos anteriores
    this.puntos = [];
    this.estadisticas = null;

    this.geocodificadorService.obtenerCoordenadasVisor(this.filtrosAplicados)
      .subscribe({
        next: (response) => {
          console.log('✅ Datos recibidos del servidor');
          console.log('📈 Response:', response);

          if (response.success && response.puntos && response.puntos.length > 0) {
            this.puntos = response.puntos;
            this.estadisticas = response.estadisticas;

            console.log('📊 Estadísticas recibidas:');
            console.log('  Total en BD:', response.estadisticas?.totalEnBD || 'N/A');
            console.log('  Puntos obtenidos:', response.puntos?.length || 0);
            console.log('  Por categoría:', response.estadisticas?.porCategoria || 'N/A');

            // Actualizar estadísticas en los filtros
            this.actualizarEstadisticasFiltros();

            // Agregar marcadores al mapa
            this.agregarMarcadoresReales();

            // Si hay muchos puntos, mostrar advertencia en consola
            if (this.puntos.length > 10000) {
              console.warn('⚠️ Muchos puntos para renderizar:', this.puntos.length);
              console.warn('💡 Recomendación: Considera usar clustering para mejorar rendimiento');
            }

            // Centrar el mapa en los datos si hay muchos
            if (this.puntos.length > 0 && this.map) {
              this.ajustarVistaMapa();
            }

            // Llamar al método de diagnóstico
            this.diagnosticarDatosFaltantes();

          } else {
            console.log('📭 No se encontraron puntos con los filtros actuales');
            this.mostrarMensajeSinDatos();
          }

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ Error al cargar datos:', error);
          console.error('Error completo:', error);

          // Manejo de errores específicos
          let mensajeError = 'Error al cargar los datos del servidor';

          if (error.name === 'TimeoutError' || error.status === 408) {
            mensajeError = 'La consulta tardó demasiado. Intenta con filtros más específicos.';
          } else if (error.status === 404) {
            mensajeError = 'Endpoint no encontrado. Verifica que la ruta sea correcta.';
            console.error('⚠️ Error 404: Revisa que el backend tenga la ruta /api/visor/coordenadas');
          } else if (error.status === 500) {
            mensajeError = 'Error interno del servidor. Verifica que el backend esté funcionando.';
          }

          this.mostrarErrorEnMapa(mensajeError, error.error?.detalle || error.message);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Método para diagnóstico
// Método para diagnóstico
diagnosticarDatosFaltantes(): void {
  console.log('🔍 DIAGNÓSTICO DE DATOS');
  console.log('========================');

  if (this.estadisticas && this.estadisticas.totalEnBD !== undefined) {
    console.log(`Total en BD según estadísticas: ${this.estadisticas.totalEnBD}`);
    console.log(`Puntos cargados en el mapa: ${this.puntos.length}`);

    const diferencia = this.estadisticas.totalEnBD - this.puntos.length;
    console.log(`📉 Diferencia: ${diferencia} registros no cargados`);

    if (diferencia > 0) {
      console.log('⚠️ Posibles causas:');
      console.log('   1. Algunos registros no tienen coordenadas válidas (latitud/longitud son NULL o 0)');
      console.log('   2. Los filtros están excluyendo algunos registros');
      console.log('   3. Problema con la calidad mínima/máxima en los parámetros');

      // Verificar si hay puntos sin coordenadas válidas
      const puntosSinCoordenadas = this.puntos.filter(p =>
        !p.latitud || !p.longitud || p.latitud === 0 || p.longitud === 0
      );

      console.log(`   Puntos sin coordenadas válidas en los datos cargados: ${puntosSinCoordenadas.length}`);

      // Sugerir prueba sin filtros
      console.log('💡 Prueba: Revisa directamente en el backend con esta URL:');
      console.log(`   http://localhost:3000/api/visor/coordenadas?calidad_minima=0&calidad_maxima=100`);
    }
  } else {
    console.log('No hay estadísticas disponibles para diagnóstico');
  }
  console.log('========================');
}

  ajustarVistaMapa(): void {
    if (!this.map || this.puntos.length === 0) return;

    const L = window.L;

    try {
      if (this.puntos.length === 1) {
        // Si solo hay un punto, centrar en él
        const punto = this.puntos[0];
        this.map.setView([punto.latitud, punto.longitud], 15);
      } else if (this.puntos.length > 1 && this.puntos.length <= 100) {
        // Si hay pocos puntos, ajustar vista para mostrarlos todos
        const bounds = L.latLngBounds(this.puntos.map(p => [p.latitud, p.longitud]));
        this.map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // Si hay muchos puntos, mantener vista inicial o centrar en el primero
        const primerPunto = this.puntos[0];
        this.map.setView([primerPunto.latitud, primerPunto.longitud], this.zoomInicial);
      }
    } catch (error) {
      console.error('Error ajustando vista del mapa:', error);
    }
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
            <p style="margin-top: 10px; font-size: 12px; color: #999;">
              Intenta cambiar los filtros de calidad o ajustar los parámetros de búsqueda.
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
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
              Verifica que el backend esté corriendo en http://localhost:3000/api/visor/coordenadas
            </p>
          </div>
        `)
        .openOn(this.map);
    }
  }

  actualizarEstadisticasFiltros(): void {
    if (!this.estadisticas) return;

    this.filtros.forEach(filtro => {
      switch(filtro.nivel) {
        case 'Alto':
          filtro.cantidad = this.estadisticas!.porCategoria.alto || 0;
          break;
        case 'Medio':
          filtro.cantidad = this.estadisticas!.porCategoria.medio || 0;
          break;
        case 'Bajo':
          filtro.cantidad = this.estadisticas!.porCategoria.bajo || 0;
          break;
        case 'Muy Bajo':
          filtro.cantidad = this.estadisticas!.porCategoria.muyBajo || 0;
          break;
      }
    });
  }

  agregarMarcadoresReales(): void {
    if (!this.map || !this.puntos.length) {
      console.log('No hay puntos para mostrar o mapa no está disponible');
      return;
    }

    const L = window.L;

    // Limpiar marcadores anteriores
    this.limpiarMarcadores();

    console.log(`📍 Agregando ${this.puntos.length} marcadores...`);

    let marcadoresAgregados = 0;

    this.puntos.forEach((punto) => {
      // Verificar si el punto pasa los filtros activos
      if (!this.cumpleFiltros(punto)) {
        return;
      }

      // Crear icono personalizado
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

      // Crear marcador
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
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <em>Haz clic fuera para cerrar</em>
          </div>
        </div>
      `);

      this.markers.push(marker);
      marcadoresAgregados++;
    });

    console.log(`✅ ${marcadoresAgregados} marcadores agregados al mapa (filtrados: ${this.puntos.length - marcadoresAgregados})`);
  }

  cumpleFiltros(punto: PuntoMapa): boolean {
    // Filtrar por nivel de confianza según filtros activos
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
      console.log('🗑️ Marcadores limpiados');
    }
  }

  // Métodos de filtros
  alternarFiltro(nivel: string): void {
    console.log('Filtro alternado:', nivel);
    const filtro = this.filtros.find(f => f.nivel === nivel);
    if (filtro) {
      filtro.activo = !filtro.activo;
      console.log(`Filtro ${nivel} ahora está: ${filtro.activo ? 'activo' : 'inactivo'}`);
      this.actualizarMapaSegunFiltros();
    }
  }

  estaFiltroActivo(nivel: string): boolean {
    const filtro = this.filtros.find(f => f.nivel === nivel);
    return filtro ? filtro.activo : false;
  }

  seleccionarTodos(): void {
    console.log('Seleccionar todos');
    this.filtros.forEach(filtro => filtro.activo = true);
    this.actualizarMapaSegunFiltros();
  }

  deseleccionarTodos(): void {
    console.log('Deseleccionar todos');
    this.filtros.forEach(filtro => filtro.activo = false);
    this.actualizarMapaSegunFiltros();
  }

  actualizarMapaSegunFiltros(): void {
    console.log('Actualizando mapa según filtros activos:',
      this.filtros.filter(f => f.activo).map(f => f.nivel));

    // Reagregar marcadores con los nuevos filtros
    this.agregarMarcadoresReales();
    this.cdr.detectChanges();
  }

  // Método para buscar direcciones
  buscarDirecciones(): void {
    if (!this.terminoBusqueda || this.terminoBusqueda.length < 3) {
      console.log('Término de búsqueda demasiado corto');
      return;
    }

    this.buscando = true;
    this.cdr.detectChanges();

    this.geocodificadorService.buscarDirecciones(this.terminoBusqueda)
      .subscribe({
        next: (response) => {
          console.log('Resultados de búsqueda:', response.resultados?.length || 0);
          this.buscando = false;

          if (response.success && response.resultados && response.resultados.length > 0) {
            // Limpiar marcadores actuales
            this.limpiarMarcadores();

            // Agregar solo los resultados de búsqueda
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

            // Centrar en el primer resultado
            const primerResultado = response.resultados[0];
            this.map.setView([primerResultado.latitud, primerResultado.longitud], 15);

          } else {
            // Mostrar mensaje de no resultados
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
          console.error('Error en búsqueda:', error);
          this.buscando = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Limpiar búsqueda y mostrar todos los puntos
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.buscando = false;
    // Volver a cargar todos los puntos
    this.limpiarMarcadores();
    this.agregarMarcadoresReales();
    this.cdr.detectChanges();
  }

  showMapError(message: string): void {
    console.error('Mostrando error:', message);
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
                  style="margin-top: 20px; padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px; transition: background 0.3s;"
                  onmouseover="this.style.background='#2980b9'"
                  onmouseout="this.style.background='#3498db'">
            🔄 Recargar página
          </button>
        </div>
      `;
    }
  }
}
