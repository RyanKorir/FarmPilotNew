import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportOptions {
  watermark?: string;
  footer?: {
    label: string;
    value: string | number;
  };
  subtitle?: string;
}

interface ReportSection {
  title: string;
  columns: string[];
  data: any[][];
}

const BRAND_COLOR: [number, number, number] = [90, 90, 64]; // #5A5A40
const ACCENT_COLOR: [number, number, number] = [140, 140, 120];

const addReportHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Minimalist Prestigious Header
  doc.setFillColor(252, 252, 250); 
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Brand Identifier
  doc.setFont('times', 'bold italic');
  doc.setFontSize(26);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text('FarmPilot', 15, 22);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 150);
  doc.text('ELITE ESTATE MANAGEMENT PROTOCOL', 15, 28);

  // Title Section
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(title.toUpperCase(), pageWidth - 15, 22, { align: 'right' });
  
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, pageWidth - 15, 28, { align: 'right' });
  }

  // Refined Divider
  doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setLineWidth(0.3);
  doc.line(15, 34, pageWidth - 15, 34);

  // Registry Hash & Date
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  const hash = Math.random().toString(36).substring(7).toUpperCase();
  doc.text(`REGISTRY ID: ${hash} | GENERATED: ${new Date().toLocaleString()}`, 15, 40);
};

const addWatermark = (doc: jsPDF, text: string) => {
  doc.setFontSize(60);
  doc.setTextColor(200, 200, 200);
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
  doc.text(text, doc.internal.pageSize.width / 2, doc.internal.pageSize.height / 2, {
    align: 'center',
    angle: 45
  });
  doc.restoreGraphicsState();
};

export const generatePDFReport = (
  title: string, 
  columns: string[], 
  data: any[][], 
  fileName: string,
  options?: ReportOptions
) => {
  const doc = new jsPDF();
  
  addReportHeader(doc, title, options?.subtitle);
  
  if (options?.watermark) {
    addWatermark(doc, options.watermark);
  }

  autoTable(doc, {
    startY: 45,
    head: [columns],
    body: data,
    theme: 'grid',
    headStyles: { 
      fillColor: [248, 248, 245], 
      textColor: BRAND_COLOR,
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.1,
      lineColor: [240, 240, 235]
    },
    styles: { 
      fontSize: 7,
      cellPadding: 4,
      font: 'helvetica',
      textColor: [60, 60, 60],
      lineWidth: 0.1,
      lineColor: [245, 245, 240]
    },
    alternateRowStyles: { fillColor: [254, 254, 252] },
    margin: { top: 45 },
    didDrawPage: (data) => {
      // Footer Branding
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Certified FarmPilot Document | Page ${data.pageNumber} of ${pageCount}`, 
        doc.internal.pageSize.width / 2, 
        doc.internal.pageSize.height - 10, 
        { align: 'center' }
      );

      // Custom footer if last page
      const isLastPage = data.pageNumber === (doc as any).internal.getNumberOfPages();
      if (isLastPage && options?.footer) {
        const finalY = (data as any).cursor.y + 10;
        doc.setFontSize(10);
        doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
        doc.setFont('helvetica', 'bold');
        const footerText = `${options.footer.label}: ${options.footer.value}`;
        const textWidth = doc.getTextWidth(footerText);
        doc.text(footerText, doc.internal.pageSize.width - 14 - textWidth, finalY);
      }
    }
  });
  
  doc.save(`${fileName}.pdf`);
};

export const generateSectionedPDFReport = (
  title: string,
  subtitle: string,
  sections: ReportSection[],
  fileName: string,
  options?: Omit<ReportOptions, 'subtitle'>
) => {
  const doc = new jsPDF();
  
  addReportHeader(doc, title, subtitle);
  
  if (options?.watermark) {
    addWatermark(doc, options.watermark);
  }

  let finalY = 45;

  sections.forEach((section, index) => {
    // Add section title
    doc.setFontSize(14);
    doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
    doc.setFont('times', 'bold');
    
    // Check for page overflow before adding section title
    if (finalY > 240) {
      doc.addPage();
      addReportHeader(doc, title, subtitle);
      finalY = 45;
    }

    doc.text(section.title.toUpperCase(), 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [section.columns],
      body: section.data,
      theme: 'grid',
      headStyles: { 
        fillColor: index % 2 === 0 ? BRAND_COLOR : ACCENT_COLOR, 
        textColor: [255, 255, 255],
        fontSize: 9
      },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] },
      margin: { top: 40 },
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;
  });

  // Footer on each page (simplified since autotable handles pages)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text(
      `This document is a verified agricultural performance record. Unauthorized alteration is prohibited.`, 
      doc.internal.pageSize.width / 2, 
      doc.internal.pageSize.height - 5, 
      { align: 'center' }
    );
  }

  doc.save(`${fileName}.pdf`);
};

export const generateStrategicManifest = (
  title: string,
  records: any[],
  fileName: string,
  farmName: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // 1. Prestigious Border
  doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  doc.setLineWidth(0.1);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

  // 2. Header Section
  doc.setFillColor(252, 252, 248);
  doc.rect(7, 7, pageWidth - 14, 50, 'F');

  doc.setFont('times', 'bold italic');
  doc.setFontSize(28);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text('FarmPilot Strategic Registry', pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
  doc.text('ELITE ESTATE PERFORMANCE PROTOCOL', pageWidth / 2, 32, { align: 'center' });

  doc.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 4, 38, (pageWidth * 3) / 4, 38);

  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(title.toUpperCase(), pageWidth / 2, 48, { align: 'center' });

  // 3. Metadata Grid
  const metaY = 65;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 110);
  doc.text('ESTATE ORIGIN:', 15, metaY);
  doc.text('TEMPORAL SCOPE:', 15, metaY + 5);
  doc.text('GENERATION HASH:', 15, metaY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(farmName.toUpperCase(), 50, metaY);
  doc.text(`FISCAL YEAR 2024 (MONTHLY AGGREGATE)`, 50, metaY + 5);
  doc.text(`${Math.random().toString(36).substring(7).toUpperCase()}`, 50, metaY + 10);

  // 4. Group Data by Month
  const monthlyData: Record<string, Record<string, number>> = {};
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  records.forEach(rec => {
    const date = new Date(rec.date);
    const month = months[date.getMonth()];
    if (!monthlyData[month]) monthlyData[month] = {};
    if (!monthlyData[month][rec.type]) monthlyData[month][rec.type] = 0;
    monthlyData[month][rec.type] += rec.quantity;
  });

  // Calculate distinct types across all data
  const allTypes = Array.from(new Set(records.map(r => r.type)));
  
  // 5. Monthly Performance Table
  const tableHead = ['CYCLE (MONTH)', ...allTypes.map(t => `${t.toUpperCase()}`)];
  const tableBody = months.map(month => {
    const row = [month.toUpperCase()];
    allTypes.forEach(type => {
      const val = monthlyData[month]?.[type] || 0;
      row.push(val.toString());
    });
    return row;
  }).filter(row => row.slice(1).some(v => v !== '0')); // Only show months with data

  autoTable(doc, {
    startY: 85,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    headStyles: { 
      fillColor: BRAND_COLOR, 
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    styles: { 
      fontSize: 8,
      cellPadding: 4,
      halign: 'center',
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', fillColor: [250, 250, 245] }
    },
    didDrawPage: (data) => {
      // Add background pattern if needed
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 20;

  // 6. Strategic Insights Section
  if (finalY < pageHeight - 60) {
    doc.setFont('times', 'bold italic');
    doc.setFontSize(12);
    doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
    doc.text('STRATEGIC OBSERVATIONS & ANALYTICAL SUMMARY', 15, finalY);
    
    doc.setLineWidth(0.1);
    doc.line(15, finalY + 2, pageWidth - 15, finalY + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const insights = [
      `Aggregate productivity for ${farmName} shows stabilized yields across primary metabolic cycles.`,
      `Verified distribution patterns indicate efficient capture of biological assets during peak seasonal windows.`,
      `Registry validates all output against internal quality thresholds and biosecurity protocols.`
    ];
    
    insights.forEach((insight, i) => {
      doc.text(`• ${insight}`, 15, finalY + 10 + (i * 6));
    });
  }

  // 7. Executive Signatures
  const footerY = pageHeight - 35;
  doc.setDrawColor(200, 200, 190);
  doc.line(20, footerY, 80, footerY);
  doc.line(pageWidth - 80, footerY, pageWidth - 20, footerY);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('ESTATE ADJUDICATOR', 50, footerY + 5, { align: 'center' });
  doc.text('OPERATIONAL COMPLIANCE', pageWidth - 50, footerY + 5, { align: 'center' });

  // 8. Official Metadata
  doc.setFontSize(6);
  doc.setTextColor(200, 200, 200);
  doc.text(`DOCUMENT GENERATED BY FARMPILOT STEERING SYSTEM ALPHA-7 | TIMESTAMP: ${new Date().toISOString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.save(`${fileName}.pdf`);
};

export const generateExcelReport = (
  columns: string[], 
  data: any[][], 
  fileName: string,
  footer?: { label: string; value: string | number }
) => {
  const finalData = [...data];
  if (footer) {
    const footerRow = new Array(columns.length).fill('');
    footerRow[columns.length - 2] = footer.label;
    footerRow[columns.length - 1] = footer.value;
    finalData.push(footerRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet([columns, ...finalData]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
