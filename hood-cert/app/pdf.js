/* global jspdf */
(function (global) {
  'use strict';

  const DISCLAIMER =
    'This document is a service record from your kitchen exhaust cleaning company. It is not a fire inspection, code compliance certification, or NFPA compliance certificate. Cleaning frequency guidance references NFPA 96 cooking-volume schedules. The authority having jurisdiction and your insurer determine what documentation they accept.';

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
   * @param {{
   *   companyName: string,
   *   techName: string,
   *   account: { name: string, address: string },
   *   serviceDate: string,
   *   nextDue: string,
   *   checklist: Array<{ id: string, status: string, note?: string, beforePhoto?: string, afterPhoto?: string }>
   * }} payload
   */
  function generateServiceRecordPdf(payload) {
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 48;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const contentW = pageW - margin * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(payload.companyName || 'Your hood cleaning company', margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('Kitchen exhaust cleaning service record', margin, y);
    doc.setTextColor(0);

    doc.setFontSize(9);
    const metaX = pageW - margin;
    doc.text(`Service date: ${payload.serviceDate}`, metaX, margin, { align: 'right' });
    doc.text(`Technician: ${payload.techName}`, metaX, margin + 12, { align: 'right' });
    doc.text(`Next due: ${payload.nextDue}`, metaX, margin + 24, { align: 'right' });

    y += 8;
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

    payload.checklist.forEach((item) => {
      const label = AREA_LABELS[item.id] || item.id;
      const status = item.status === 'deficiency' ? 'Deficiency' : 'Pass';
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.status === 'deficiency' ? 220 : 22, item.status === 'deficiency' ? 38 : 163, item.status === 'deficiency' ? 38 : 74);
      doc.text(status, pageW - margin, y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      y += 12;
      if (item.status === 'deficiency' && item.note) {
        const noteLines = doc.splitTextToSize(`Note: ${item.note}`, contentW - 20);
        doc.setTextColor(80);
        doc.text(noteLines, margin + 12, y);
        doc.setTextColor(0);
        y += noteLines.length * 11;
      }
      y += 4;
      if (y > 680) {
        doc.addPage();
        y = margin;
      }
    });

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Photo documentation', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');

    const photoEntries = [];
    payload.checklist.forEach((item) => {
      if (item.beforePhoto) {
        photoEntries.push({ label: `${AREA_LABELS[item.id] || item.id} (before)`, data: item.beforePhoto });
      }
      if (item.afterPhoto) {
        photoEntries.push({ label: `${AREA_LABELS[item.id] || item.id} (after)`, data: item.afterPhoto });
      }
    });

    const cols = 2;
    const cellW = (contentW - 12) / cols;
    const imgH = 72;
    let col = 0;
    let rowY = y;

    photoEntries.forEach((photo, idx) => {
      if (rowY + imgH + 24 > 720) {
        doc.addPage();
        rowY = margin;
        col = 0;
      }
      const x = margin + col * (cellW + 12);
      doc.setFontSize(8);
      doc.text(photo.label, x, rowY);
      try {
        const format = photo.data.indexOf('image/png') >= 0 ? 'PNG' : 'JPEG';
        doc.addImage(photo.data, format, x, rowY + 6, cellW, imgH);
      } catch (_e) {
        doc.rect(x, rowY + 6, cellW, imgH);
        doc.setFontSize(8);
        doc.text('Photo unavailable', x + 4, rowY + 40);
      }
      col += 1;
      if (col >= cols) {
        col = 0;
        rowY += imgH + 28;
      }
    });

    if (col !== 0) {
      rowY += imgH + 28;
    }
    y = rowY + 8;

    if (y > 640) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(8);
    doc.setTextColor(90);
    const discLines = doc.splitTextToSize(DISCLAIMER, contentW);
    doc.text(discLines, margin, y);
    doc.setTextColor(0);

    const slug = payload.account.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'service-record';
    const filename = `hood-service-record-${slug}.pdf`;
    doc.save(filename);
    return filename;
  }

  /**
   * @param {{
   *   companyName: string,
   *   account: { name: string, email?: string },
   *   serviceDate: string,
   *   nextDue: string,
   *   deficiencyCount: number
   * }} summary
   */
  function buildMailtoSummary(summary) {
    const subject = encodeURIComponent(
      `${summary.companyName} hood cleaning service record - ${summary.account.name} - ${summary.serviceDate}`
    );
    const bodyLines = [
      `Hi,`,
      ``,
      `Attached is the kitchen exhaust cleaning service record for ${summary.account.name} from ${summary.serviceDate}.`,
      `Next cleaning due: ${summary.nextDue}.`,
      summary.deficiencyCount > 0
        ? `Note: ${summary.deficiencyCount} area(s) logged with deficiency notes on this visit.`
        : `All checklist areas passed on this visit.`,
      ``,
      `Please attach the PDF you downloaded from Hood Cert Pack to this email.`,
      ``,
      `This is a service record from ${summary.companyName}, not a fire inspection or code certification.`,
      ``,
      `Thank you,`,
      summary.companyName
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    const to = summary.account.email ? encodeURIComponent(summary.account.email) : '';
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  global.HoodCertPdf = {
    generateServiceRecordPdf,
    buildMailtoSummary,
    AREA_LABELS,
    DISCLAIMER
  };
})(window);
