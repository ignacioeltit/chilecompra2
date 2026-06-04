import ExcelJS from 'exceljs'
import { type LicitacionConAlerta, ESTADOS_LICITACION, RESULTADOS, ALERTAS } from '@/types'
import { formatFechaHora } from './format'

export async function exportarExcel(licitaciones: LicitacionConAlerta[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Chilecompra2'
  wb.created = new Date()

  const ws = wb.addWorksheet('Licitaciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: 'Código',          key: 'codigo',       width: 22 },
    { header: 'Nombre',          key: 'nombre',       width: 45 },
    { header: 'Institución',     key: 'institucion',  width: 30 },
    { header: 'Estado',          key: 'estado',       width: 18 },
    { header: 'Resultado',       key: 'resultado',    width: 18 },
    { header: 'Publicación',     key: 'publicacion',  width: 20 },
    { header: 'Cierre 1',        key: 'cierre1',      width: 20 },
    { header: 'Cierre 2',        key: 'cierre2',      width: 20 },
    { header: 'Monto CLP',       key: 'monto',        width: 14 },
    { header: 'Orden de Compra', key: 'oc',           width: 18 },
    { header: 'Estado OC',       key: 'estado_oc',    width: 12 },
    { header: 'Alerta',          key: 'alerta',       width: 20 },
    { header: 'Notas',           key: 'notas',        width: 50 },
    { header: 'Creado en',       key: 'creado_en',    width: 20 },
  ]

  // Estilo de cabecera
  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { vertical: 'middle' }
  })
  ws.getRow(1).height = 20

  for (const l of licitaciones) {
    ws.addRow({
      codigo:      l.codigo_chilecompra,
      nombre:      l.nombre,
      institucion: l.institucion,
      estado:      ESTADOS_LICITACION[l.estado] ?? l.estado,
      resultado:   l.resultado ? (RESULTADOS[l.resultado] ?? l.resultado) : '',
      publicacion: l.fecha_publicacion ? formatFechaHora(l.fecha_publicacion) : '',
      cierre1:     formatFechaHora(l.fecha_cierre_1),
      cierre2:     l.fecha_cierre_2 ? formatFechaHora(l.fecha_cierre_2) : '',
      monto:       l.monto_clp ?? '',
      oc:          l.orden_compra ?? '',
      estado_oc:   l.estado_oc ?? '',
      alerta:      ALERTAS[l.categoria_alerta_calc].label,
      notas:       l.notas ?? '',
      creado_en:   formatFechaHora(l.creado_en),
    })
  }

  // Alternar color de filas
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const fill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: rowNumber % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF' },
    }
    row.eachCell(cell => { cell.fill = fill })
  })

  // Generar y descargar
  const buffer = await wb.xlsx.writeBuffer()
  const fecha = new Date().toISOString().slice(0, 10)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // En browser usamos un <a> temporal
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `licitaciones_${fecha}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
