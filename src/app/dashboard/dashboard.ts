import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DirectionService } from '../services/direction.service';

interface Direccion {
  id_salida: number;
  id_entrada?: number;
  id_lote?: number;
  direccion_original: string;
  direccion_completa?: string;
  colonia?: string;
  alcaldia_municipio?: string;
  entidad_federativa?: string;
  codigopostal?: string;
  latitud?: number;
  longitud?: number;
  confianza?: number;
  calidad?: string;
  fuente?: string;
  tipo_vialidad?: string;
  nombre_vialidad?: string;
  numero_exterior?: string;
  numero_interior?: string;
  coincidencia_exacta?: boolean;
  fecha_creacion?: Date;
  fecha_actualizacion?: Date;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  sidebarOpen = true;
  paginaSeleccionada = 'tabla';
  direcciones: Direccion[] = [];
  direccionesProcesadas: any[] = [];
  cargando: boolean = false;
  error: string = '';
  totalRegistros: number = 0;
  eliminandoId: number | null = null;

  columnasVisibles: {[key: string]: boolean} = {
    id_salida: true,
    id_entrada: true,
    direccion_original: true,
    colonia: true,
    alcaldia_municipio: true,
    entidad_federativa: true,
    codigopostal: true,
    latitud: true,
    longitud: true,
    confianza: true
  };

  filtroBusqueda: string = '';
  registrosPorPagina: number = 15;
  paginaActual: number = 1;
  totalPaginas: number = 1;
  columnaOrden: string = 'id_salida';
  ordenAscendente: boolean = true;
  registroSeleccionado: Direccion | null = null;
  modoEdicion: boolean = false;

  constructor(
    private directionService: DirectionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDirecciones();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.cdr.detectChanges();
  }

  cambiarPagina(pagina: string) {
    this.paginaSeleccionada = pagina;
    if (this.modoEdicion) {
      this.cancelarEdicion();
    }
    this.cdr.detectChanges();
  }

  cargarDirecciones() {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.directionService.obtenerTodasDirecciones()
      .subscribe({
        next: (datos: any[]) => {
          if (datos && Array.isArray(datos)) {
            this.direcciones = datos;
            this.totalRegistros = datos.length;
            this.procesarParaTabla();
            this.calcularPaginacion();
            this.error = '';
          } else {
            this.direcciones = [];
            this.error = 'No se pudo conectar con el servidor';
          }
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = 'No se pudo conectar con el servidor';
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
  }

  procesarParaTabla() {
    if (!this.direcciones || this.direcciones.length === 0) {
      this.direccionesProcesadas = [];
      return;
    }

    let datosFiltrados = this.direcciones;
    if (this.filtroBusqueda.trim()) {
      const busqueda = this.filtroBusqueda.toLowerCase();
      datosFiltrados = this.direcciones.filter(item =>
        item.direccion_original?.toLowerCase().includes(busqueda) ||
        item.alcaldia_municipio?.toLowerCase().includes(busqueda) ||
        item.colonia?.toLowerCase().includes(busqueda) ||
        item.codigopostal?.includes(busqueda)
      );
    }

    datosFiltrados.sort((a: Direccion, b: Direccion) => {
      const valorA = a[this.columnaOrden as keyof Direccion];
      const valorB = b[this.columnaOrden as keyof Direccion];

      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return this.ordenAscendente ? -1 : 1;
      if (valorB == null) return this.ordenAscendente ? 1 : -1;

      if (typeof valorA === 'string' && typeof valorB === 'string') {
        return this.ordenAscendente
          ? valorA.localeCompare(valorB)
          : valorB.localeCompare(valorA);
      }

      return this.ordenAscendente
        ? (valorA < valorB ? -1 : 1)
        : (valorB < valorA ? -1 : 1);
    });

    this.direccionesProcesadas = datosFiltrados.map((item: Direccion, index: number) => ({
      id_salida: item.id_salida,
      id_entrada: item.id_entrada,
      direccion_original: item.direccion_original || 'Sin dirección',
      direccion_completa: item.direccion_completa || '',
      colonia: item.colonia || '',
      alcaldia_municipio: item.alcaldia_municipio || '',
      entidad_federativa: item.entidad_federativa || '',
      codigopostal: item.codigopostal || '',
      latitud: item.latitud,
      longitud: item.longitud,
      confianza: item.confianza || 0,
      confianza_porcentaje: item.confianza ? (item.confianza * 100).toFixed(1) + '%' : 'N/A',
      index: index + 1,
      tiene_coordenadas: !!(item.latitud && item.longitud),
      calidad: item.calidad || '',
      fuente: item.fuente || '',
      datosOriginales: { ...item }
    }));

    this.calcularPaginacion();
  }

  editarRegistro(registro: any) {
    this.registroSeleccionado = { ...registro.datosOriginales };
    this.modoEdicion = true;
  }

  guardarCambios() {
    if (!this.registroSeleccionado) return;

    if (typeof (this.directionService as any).updateDirection === 'function') {
      (this.directionService as any).updateDirection(this.registroSeleccionado)
        .subscribe({
          next: (respuesta: ApiResponse) => {
            alert('Registro actualizado correctamente');
            const index = this.direcciones.findIndex(d => d.id_salida === this.registroSeleccionado!.id_salida);
            if (index !== -1) {
              this.direcciones[index] = { ...this.registroSeleccionado! };
              this.procesarParaTabla();
            }
            this.cancelarEdicion();
          },
          error: (err: any) => {
            alert('Error al actualizar el registro: ' + err.message);
          }
        });
    }
    else if (typeof (this.directionService as any).actualizarDireccion === 'function') {
      (this.directionService as any).actualizarDireccion(this.registroSeleccionado)
        .subscribe({
          next: (respuesta: ApiResponse) => {
            alert('Registro actualizado correctamente');
            const index = this.direcciones.findIndex(d => d.id_salida === this.registroSeleccionado!.id_salida);
            if (index !== -1) {
              this.direcciones[index] = { ...this.registroSeleccionado! };
              this.procesarParaTabla();
            }
            this.cancelarEdicion();
          },
          error: (err: any) => {
            alert('Error al actualizar el registro: ' + err.message);
          }
        });
    }
    else {
      const index = this.direcciones.findIndex(d => d.id_salida === this.registroSeleccionado!.id_salida);
      if (index !== -1) {
        this.direcciones[index] = { ...this.registroSeleccionado! };
        this.procesarParaTabla();
        alert('Registro actualizado localmente');
      }
      this.cancelarEdicion();
    }
  }

  cancelarEdicion() {
    this.registroSeleccionado = null;
    this.modoEdicion = false;
    this.cdr.detectChanges();
  }

  eliminarRegistro(registro: any) {
    const confirmar = confirm(`¿Estás seguro de eliminar el registro ${registro.id_salida}?\n\nDirección: ${registro.direccion_original}`);

    if (!confirmar) return;

    this.eliminandoId = registro.id_salida;
    this.cdr.detectChanges();

    this.directionService.eliminarDireccion(registro.id_salida)
      .subscribe({
        next: (respuesta: any) => {
          this.eliminandoId = null;

          if (respuesta.success || respuesta.message) {
            alert(respuesta.message || 'Registro eliminado correctamente');
          } else {
            alert('Registro eliminado correctamente');
          }

          this.direcciones = this.direcciones.filter(d => d.id_salida !== registro.id_salida);
          this.procesarParaTabla();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.eliminandoId = null;

          if (err.message.includes('404') || err.message.includes('no existe')) {
            alert('El registro ya no existe en el servidor. Actualizando lista...');
            this.cargarDirecciones();
          } else if (err.message.includes('No se puede conectar')) {
            alert('No se pudo conectar al servidor. Verifica que el servidor esté en ejecución.');
          } else {
            alert('Error al eliminar el registro: ' + err.message);
          }
          this.cdr.detectChanges();
        }
      });
  }

  calcularPaginacion() {
    this.totalPaginas = Math.max(1, Math.ceil(this.direccionesProcesadas.length / this.registrosPorPagina));
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = this.totalPaginas;
    }
  }

  get registrosPaginaActual() {
    const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
    const fin = inicio + this.registrosPorPagina;
    return this.direccionesProcesadas.slice(inicio, fin);
  }

  cambiarPaginaTabla(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  ordenarPor(columna: string) {
    if (this.columnaOrden === columna) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.columnaOrden = columna;
      this.ordenAscendente = true;
    }
    this.procesarParaTabla();
  }

  onBuscar() {
    this.paginaActual = 1;
    this.procesarParaTabla();
  }

  limpiarBusqueda() {
    this.filtroBusqueda = '';
    this.onBuscar();
  }

  mostrarDetalles(item: any) {
    const detalles = `📋 DETALLES COMPLETOS DEL REGISTRO

🔢 IDENTIFICADORES:
  ID Salida: ${item.id_salida}
  ID Entrada: ${item.id_entrada}

📍 DIRECCIÓN:
  ${item.direccion_original}

🌍 UBICACIÓN:
  Colonia: ${item.colonia}
  Municipio: ${item.alcaldia_municipio}
  Estado: ${item.entidad_federativa}
  CP: ${item.codigopostal}

🌐 COORDENADAS:
  Latitud: ${item.latitud || 'N/A'}
  Longitud: ${item.longitud || 'N/A'}

📊 METADATOS:
  Confianza: ${item.confianza_porcentaje}
  Calidad: ${item.calidad}
  Fuente: ${item.fuente}
  ${item.tiene_coordenadas ? '✅ Con coordenadas' : '❌ Sin coordenadas'}
    `;

    alert(detalles);
  }

  mostrarEnMapa(item: any) {
    if (item.latitud && item.longitud) {
      const url = `https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`;
      window.open(url, '_blank');
    } else {
      alert('No hay coordenadas para mostrar en el mapa');
    }
  }

  exportarCSV() {
    if (this.direccionesProcesadas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = ['ID Salida', 'ID Entrada', 'Dirección', 'Colonia', 'Municipio', 'Estado', 'CP', 'Latitud', 'Longitud', 'Confianza'];
    const csvContent = [
      headers.join(','),
      ...this.direccionesProcesadas.map(row =>
        [
          `"${row.id_salida || ''}"`,
          `"${row.id_entrada || ''}"`,
          `"${row.direccion_original || ''}"`,
          `"${row.colonia || ''}"`,
          `"${row.alcaldia_municipio || ''}"`,
          `"${row.entidad_federativa || ''}"`,
          `"${row.codigopostal || ''}"`,
          row.latitud || '',
          row.longitud || '',
          row.confianza_porcentaje || ''
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geocodificador_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  contarConCoordenadas(): number {
    return this.direccionesProcesadas.filter(d => d.tiene_coordenadas).length;
  }

  contarRegistros(): number {
    return this.direccionesProcesadas.length;
  }

  toggleColumna(columna: string) {
    if (this.columnasVisibles.hasOwnProperty(columna)) {
      this.columnasVisibles[columna] = !this.columnasVisibles[columna];
      this.cdr.detectChanges();
    }
  }

  obtenerListaColumnas(): any[] {
    return [
      { key: 'id_salida', label: 'ID Salida' },
      { key: 'id_entrada', label: 'ID Entrada' },
      { key: 'direccion_original', label: 'Dirección' },
      { key: 'colonia', label: 'Colonia' },
      { key: 'alcaldia_municipio', label: 'Municipio' },
      { key: 'entidad_federativa', label: 'Estado' },
      { key: 'codigopostal', label: 'CP' },
      { key: 'latitud', label: 'Latitud' },
      { key: 'longitud', label: 'Longitud' },
      { key: 'confianza', label: 'Confianza' }
    ];
  }

  obtenerArrayPaginas(): number[] {
    const paginas: number[] = [];
    const inicio = Math.max(1, this.paginaActual - 2);
    const fin = Math.min(this.totalPaginas, inicio + 4);
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  calcularInicioRegistros(): number {
    return Math.min((this.paginaActual - 1) * this.registrosPorPagina + 1, this.direccionesProcesadas.length);
  }

  calcularFinRegistros(): number {
    return Math.min(this.paginaActual * this.registrosPorPagina, this.direccionesProcesadas.length);
  }

  refreshData() {
    this.cargarDirecciones();
  }
}
