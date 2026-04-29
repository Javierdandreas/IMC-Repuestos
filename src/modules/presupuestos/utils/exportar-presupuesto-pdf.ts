import type { PresupuestoCompleto } from "../types/presupuesto";

declare global {
  interface Window {
    jspdf?: {
      jsPDF: new (options?: { unit?: string; format?: string }) => JsPDFLike;
    };
  }
}

type JsPDFLike = {
  setFont: (family: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  text: (
    text: string,
    x: number,
    y: number,
    options?: { align?: "left" | "center" | "right" }
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (
    x: number,
    y: number,
    width: number,
    height: number,
    style?: "S" | "F" | "FD" | "DF"
  ) => void;
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  addPage: () => void;
  save: (filename: string) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
};

function formatearFecha(fechaISO: string) {
  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    return fechaISO;
  }

  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

function sanitizeFileName(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]+/g, "") // Eliminamos lo que no sea alfanumérico, espacio, guion o guion bajo
    .trim()
    .replace(/\s+/g, " "); // Normalizamos múltiples espacios a uno solo
}

function normalizarCodigoPdf(codigo: string) {
  return codigo.trim().replace(/\s+/g, " ");
}

function truncar(texto: string | null | undefined, max: number) {
  if (!texto) return "";
  const str = String(texto);
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

function ensureJsPdfLoaded() {
  return new Promise<new (options?: { unit?: string; format?: string }) => JsPDFLike>(
    (resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("jsPDF solo puede cargarse en el navegador."));
        return;
      }

      if (window.jspdf?.jsPDF) {
        resolve(window.jspdf.jsPDF);
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-jspdf="true"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.jspdf?.jsPDF) {
            resolve(window.jspdf.jsPDF);
            return;
          }
          reject(new Error("No se pudo inicializar jsPDF."));
        });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.async = true;
      script.dataset.jspdf = "true";
      script.onload = () => {
        if (window.jspdf?.jsPDF) {
          resolve(window.jspdf.jsPDF);
          return;
        }
        reject(new Error("No se pudo inicializar jsPDF."));
      };
      script.onerror = () => reject(new Error("No se pudo cargar jsPDF."));
      document.body.appendChild(script);
    }
  );
}

function cargarImagenComoDataUrl(src: string) {
  return new Promise<string | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawFallbackLogo(doc: JsPDFLike) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(43, 51, 63);
  doc.text("IMC", 166, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("REPUESTOS", 166, 27, { align: "right" });
}

export async function exportarPresupuestoPDF(presupuesto: PresupuestoCompleto) {
  const JsPDF = await ensureJsPdfLoaded();
  const doc = new JsPDF({ unit: "mm", format: "a4" });

  const logoPdf = await cargarImagenComoDataUrl("/logo-pdf.png");

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const colWidths = [85, 25, 12, 30, 30];
  const headers = ["Descripción", "Marca", "Cant.", "Precio Unit.", "Importe"];
  const rowHeight = 10;

  const codigoPdf = normalizarCodigoPdf(presupuesto.codigo);
  const mostrarCodigoOperacion = codigoPdf.length > 0;

  const centerX = (start: number, width: number) => start + width / 2;

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(29, 53, 95);
    doc.text("PRESUPUESTO", margin, 28);

    if (logoPdf) {
      doc.addImage(logoPdf, "PNG", 142, 10, 48, 30);
    } else {
      drawFallbackLogo(doc);
    }

    doc.setDrawColor(220, 223, 230);
    doc.line(margin, 36, pageWidth - margin, 36);

    if (mostrarCodigoOperacion) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Código OP:", 168, 48, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(codigoPdf, 171, 48);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Fecha:", 168, 56, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(formatearFecha(presupuesto.fecha), 171, 56);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Fecha:", 168, 52, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(formatearFecha(presupuesto.fecha), 171, 52);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(24, 75, 155);
    doc.text("PRESUPUESTO DE", margin, 66);
    doc.text("PARA", 95, 66);

    doc.setDrawColor(225, 228, 234);
    doc.line(89, 69, 89, 104);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text("IMC Repuestos", margin, 75);
    doc.text(truncar(presupuesto.cliente || "Sin cliente", 30), 95, 75);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text("1137357187", margin, 82);
    doc.text("Av. José E. Uriburu 475", margin, 89);
    doc.text("Pilar, Buenos Aires", margin, 96);

    doc.text(truncar(presupuesto.telefono || "", 26), 95, 82);
    doc.text(`Marca: ${truncar(presupuesto.marca || "", 16)}`, 95, 89);
    doc.text(`Modelo: ${truncar(presupuesto.modelo || "", 16)}`, 95, 96);
    doc.text(`Chasis: ${truncar(presupuesto.chasis || "", 20)}`, 95, 103);
    doc.text(`Patente: ${truncar(presupuesto.patente || "", 15)}`, 152, 89);
    doc.text(`DNI/CUIT: ${truncar(presupuesto.referencia || "", 14)}`, 152, 96);

    doc.setFillColor(18, 72, 168);
    doc.rect(margin, 111, contentWidth, rowHeight + 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);

    let x = margin;

    headers.forEach((header, index) => {
      const width = colWidths[index];

      if (index >= 2) {
        doc.text(header, centerX(x, width), 118, { align: "center" });
      } else {
        doc.text(header, x + 2, 118, { align: "left" });
      }

      x += width;
    });
  };

  drawHeader();

  let y = 122;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.setDrawColor(225, 228, 234);

  presupuesto.items.forEach((item, index) => {
    const needsNewPage = y + rowHeight + 26 > pageHeight - margin;

    if (needsNewPage) {
      doc.addPage();
      drawHeader();
      // IMPORTANTE: Resetear fuente y color después del header, 
      // ya que drawHeader termina con texto blanco para los encabezados de tabla
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      y = 122;
    }

    doc.rect(margin, y, contentWidth, rowHeight);

    const importe = item.cantidad * item.precio;

    let cellX = margin;

    let marcaVisual = item.marca?.trim() || "";

    const cells = [
      truncar(item.descripcion || "", 32),
      truncar(marcaVisual, 14),
      String(item.cantidad),
      formatearMoneda(item.precio),
      formatearMoneda(importe),
    ];

    cells.forEach((value, cellIndex) => {
      const width = colWidths[cellIndex];

      if (cellIndex >= 2) {
        doc.text(value, centerX(cellX, width), y + 6.5, { align: "center" });
      } else {
        doc.text(value, cellX + 2, y + 6.5, { align: "left" });
      }

      cellX += width;
    });

    y += rowHeight;

    const esUltimo = index === presupuesto.items.length - 1;
    if (esUltimo) {
      doc.rect(margin, y, contentWidth, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text("TOTAL", 135, y + 8);
      doc.setTextColor(18, 72, 168);
      doc.setFontSize(14);
      doc.text(formatearMoneda(presupuesto.total), 181, y + 8, {
        align: "right",
      });
      y += 18;
    }
  });

  if (presupuesto.items.length === 0) {
    doc.rect(margin, y, contentWidth, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text("No hay ítems cargados en este presupuesto.", margin + 4, y + 8);
    y += 18;
  }

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN DE OBSERVACIONES (Solo si tiene contenido)
  // ═══════════════════════════════════════════════════════════
  if (presupuesto.observaciones && presupuesto.observaciones.trim().length > 0) {
    // Verificar si necesitamos nueva página
    if (y + 30 > pageHeight - 30) {
      doc.addPage();
      y = 24;
    }

    y += 4;

    // Título "Observaciones"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(24, 75, 155);
    doc.text("OBSERVACIONES", margin, y);
    y += 5;

    // Línea separadora
    doc.setDrawColor(220, 223, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Texto de observaciones (con soporte para múltiples líneas)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    const maxLineWidth = contentWidth - 4;
    const lines: string[] = doc.splitTextToSize(presupuesto.observaciones.trim(), maxLineWidth);

    lines.forEach((line: string) => {
      if (y + 6 > pageHeight - 30) {
        doc.addPage();
        y = 24;
      }
      doc.text(line, margin + 2, y);
      y += 5;
    });

    y += 6;
  }

  if (y > pageHeight - 20) {
    doc.addPage();
    y = 24;
  }

  doc.setDrawColor(220, 223, 230);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(90, 99, 115);
  doc.text("PRESUPUESTO VÁLIDO POR 7 DÍAS", pageWidth / 2, pageHeight - 11, {
    align: "center",
  });

  const filenameParts = [
    presupuesto.cliente,
    presupuesto.marca,
    presupuesto.patente || presupuesto.modelo
  ].filter(part => part && part.trim().length > 0);

  const baseNombre = filenameParts.length > 0 
    ? filenameParts.join(" ") 
    : "presupuesto";

  const nombre = sanitizeFileName(baseNombre);
  doc.save(`${nombre || "presupuesto"}.pdf`);
}

