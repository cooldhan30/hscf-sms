import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExportColumn } from './csv'

export function downloadPdf(filename: string, title: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const doc = new jsPDF()

  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8, cellPadding: 3 },
  })

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
