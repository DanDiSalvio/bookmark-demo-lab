/* global jspdf */
(function (global) {
  'use strict';

  const DISCLAIMER =
    'This document is a service record from your kitchen exhaust cleaning company. It is not a fire inspection, code compliance certification, or NFPA compliance certificate. Cleaning frequency guidance references NFPA 96 cooking-volume schedules. The authority having jurisdiction and your insurer determine what documentation they accept.';

  const STATUS_PASS = { r: 21, g: 128, b: 61 };
  const STATUS_DEF = { r: 185, g: 28, b: 28 };

  const AREA_LABELS = {
    hood: 'Hood',
    filters: 'Filters',
    ductwork: 'Ductwork',
    fan: 'Fan',
    accessPanels: 'Access panels',
    greaseContainment: 'Grease containment',
    fireSuppressionNozzles: 'Fire-suppression nozzles visible/unobstructed'
  };

  /**
   * @param {number} imgW
   * @param {number} imgH
   * @param {number} cellW
   * @param {number} cellH
   * @param {number} maxDim
   */
  function computeDrawSize(imgW, imgH, cellW, cellH, maxDim) {
    if (!imgW || !imgH) {
      return { drawW: 0, drawH: 0, offsetX: cellW / 2, offsetY: cellH / 2 };
    }
    let drawW = imgW;
    let drawH = imgH;
    const maxSide = Math.max(drawW, drawH);
    if (maxSide > maxDim) {
      const scale = maxDim / maxSide;
      drawW *= scale;
      drawH *= scale;
    }
    const fit = Math.min(cellW / drawW, cellH / drawH, 1);
    drawW *= fit;
    drawH *= fit;
    const offsetX = (cellW - drawW) / 2;
    const offsetY = (cellH - drawH) / 2;
    return { drawW, drawH, offsetX, offsetY };
  }

  function measureDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not measure image'));
      img.src = dataUrl;
    });
  }

  function formatPhotoTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (_e) {
      return '';
    }
  }

  function makeRecordNumber(serviceDateIso) {
    const compact = (serviceDateIso || '').replace(/-/g, '');
    const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
    return `HC-${compact || '00000000'}-${suffix}`;
  }

  function getJsPdf() {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('PDF library unavailable');
    }
    return global.jspdf.jsPDF;
  }

  /**
   * @param {{
   *   companyName: string,
   *   techName: string,
   *   recordNumber: string,
   *   account: { name: string, address: string },
   *   serviceDate: string,
   *   nextDue: string,
   *   checklist: Array<{
   *     id: string,
   *     status: string,
   *     note?: string,
   *     beforePhoto?: string | null,
   *     afterPhoto?: string | null,
   *     beforeAt?: string | null,
   *     afterAt?: string | null,
   *     noAccessReason?: string | null
   *   }>
   * }} payload
   * @returns {Promise<{ doc: import('jspdf').jsPDF, filename: string }>}
   */
  async function buildServiceRecordPdf(payload) {
    const jsPDF = getJsPdf();
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 48;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const contentW = pageW - margin * 2;
    const cellW = (contentW - 12) / 2;
    const cellH = cellW * 0.75;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(payload.companyName || 'Your hood cleaning company', margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('Kitchen exhaust cleaning service record', margin, y);
    doc.setTextColor(0);

    const metaX = pageW - margin;
    doc.setFontSize(9);
    doc.text(`Record ${payload.recordNumber}`, metaX, margin, { align: 'right' });
    doc.text(`Service date: ${payload.serviceDate}`, metaX, margin + 12, { align: 'right' });
    doc.text(`Technician: ${payload.techName}`, metaX, margin + 24, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Next cleaning due: ${payload.nextDue}`, margin, margin + 42);

    y = margin + 58;
    doc.setDrawColor(194, 65, 12);
    doc.setLineWidth(2);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(payload.account.name, margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const addrLines = doc.splitTextToSize(payload.account.address, contentW);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 12 + 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Areas serviced', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const item of payload.checklist) {
      if (!item.status) continue;
      const label = AREA_LABELS[item.id] || item.id;
      const isDef = item.status === 'deficiency';
      const status = isDef ? 'Deficiency' : 'Pass';
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      const c = isDef ? STATUS_DEF : STATUS_PASS;
      doc.setTextColor(c.r, c.g, c.b);
      doc.text(status, pageW - margin, y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      y += 12;
      if (isDef && item.note) {
        const noteLines = doc.splitTextToSize(`Note: ${item.note}`, contentW - 20);
        doc.setTextColor(80);
        doc.text(noteLines, margin + 12, y);
        doc.setTextColor(0);
        y += noteLines.length * 11;
      }
      if (item.noAccessReason) {
        const naLines = doc.splitTextToSize(`No access: ${item.noAccessReason}`, contentW - 20);
        doc.setTextColor(80);
        doc.text(naLines, margin + 12, y);
        doc.setTextColor(0);
        y += naLines.length * 11;
      }
      y += 4;
      if (y > 680) {
        doc.addPage();
        y = margin;
      }
    }

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Photo documentation', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');

    for (const item of payload.checklist) {
      const label = AREA_LABELS[item.id] || item.id;
      const hasBefore = !!item.beforePhoto;
      const hasAfter = !!item.afterPhoto;
      if (!hasBefore && !hasAfter) continue;

      if (y + cellH + 40 > 720) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, margin, y);
      y += 12;

      const rowY = y;
      const pairs = [
        { kind: 'Before', data: item.beforePhoto, at: item.beforeAt },
        { kind: 'After', data: item.afterPhoto, at: item.afterAt }
      ];

      for (let i = 0; i < pairs.length; i++) {
        const photo = pairs[i];
        const x = margin + i * (cellW + 12);
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text(photo.kind, x, rowY);
        const cap = formatPhotoTime(photo.at);
        if (cap) {
          doc.text(cap, x, rowY + 10);
        }
        doc.setTextColor(0);

        const boxTop = rowY + (cap ? 16 : 12);
        doc.setDrawColor(220);
        doc.setLineWidth(0.5);
        doc.rect(x, boxTop, cellW, cellH);

        if (photo.data) {
          try {
            const dims = await measureDataUrl(photo.data);
            const fit = computeDrawSize(dims.w, dims.h, cellW, cellH, 180);
            const format = photo.data.indexOf('image/png') >= 0 ? 'PNG' : 'JPEG';
            doc.addImage(
              photo.data,
              format,
              x + fit.offsetX,
              boxTop + fit.offsetY,
              fit.drawW,
              fit.drawH
            );
          } catch (_e) {
            doc.setFontSize(8);
            doc.text('Photo unavailable', x + 8, boxTop + cellH / 2);
          }
        }
      }

      y = rowY + cellH + 22;
    }

    if (y > 640) {
      doc.addPage();
      y = margin;
    }

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Serviced by ${payload.techName}, ${payload.companyName}`, margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    const discLines = doc.splitTextToSize(DISCLAIMER, contentW);
    doc.text(discLines, margin, y);
    doc.setTextColor(0);

    const slug =
      payload.account.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() ||
      'service-record';
    const filename = `hood-service-record-${slug}.pdf`;
    return { doc, filename };
  }

  async function downloadServiceRecordPdf(payload) {
    const { doc, filename } = await buildServiceRecordPdf(payload);
    doc.save(filename);
    return filename;
  }

  async function blobServiceRecordPdf(payload) {
    const { doc, filename } = await buildServiceRecordPdf(payload);
    const blob = doc.output('blob');
    return { blob, filename };
  }

  function buildMailtoSummary(summary) {
    const subject = encodeURIComponent(
      `${summary.companyName} hood cleaning service record - ${summary.account.name} - ${summary.serviceDate}`
    );
    const defLine =
      summary.deficiencyCount > 0
        ? `Note: ${summary.deficiencyCount} areas logged with deficiency notes on this visit.`
        : 'All checklist areas passed on this visit.';
    const bodyLines = [
      'Hi,',
      '',
      `Attached is the kitchen exhaust cleaning service record (${summary.recordNumber}) for ${summary.account.name} from ${summary.serviceDate}.`,
      `Next cleaning due: ${summary.nextDue}.`,
      defLine,
      '',
      'Please attach the PDF you downloaded from Hood Cert Pack to this email.',
      '',
      `This is a service record from ${summary.companyName}, not a fire inspection or code certification.`,
      '',
      'Thank you,',
      summary.companyName
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    const to = summary.account.email ? encodeURIComponent(summary.account.email) : '';
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  global.HoodCertPdf = {
    buildServiceRecordPdf,
    downloadServiceRecordPdf,
    blobServiceRecordPdf,
    buildMailtoSummary,
    computeDrawSize,
    makeRecordNumber,
    AREA_LABELS,
    DISCLAIMER
  };
})(window);
