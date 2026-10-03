import jsPDF from 'jspdf';
import { TranscriptSegment } from '../types';
import { formatTime } from './deviceUtils';

export function exportTranscriptToPDF(
  sessionTitle: string,
  sessionCode: string,
  segments: TranscriptSegment[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ROUNDTABLE TRANSCRIPT', margin, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Session: ${sessionTitle} (${sessionCode})`, margin, 23);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 29);

  y = 45;

  if (segments.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No conversation segments recorded in this session.', margin, y);
    doc.save(`roundtable_${sessionCode}_transcript.pdf`);
    return;
  }

  // Iterate segments
  segments.forEach((seg, idx) => {
    // Check if new page needed
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }

    const timeStr = `[${formatTime(seg.start_timestamp)}]`;
    const speakerStr = `${seg.speaker_name}${seg.is_overlap ? ` (OVERLAP: ${seg.overlap_with || 'multi-speaker'})` : ''}`;

    // Speaker & Time label
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(speakerStr, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Gray
    const timeWidth = doc.getTextWidth(speakerStr);
    doc.text(timeStr, margin + timeWidth + 3, y);

    y += 5;

    // Spoken Text
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate-800
    const textLines = doc.splitTextToSize(`"${seg.text}"`, contentWidth);
    doc.text(textLines, margin + 2, y);

    y += textLines.length * 5 + 4;
  });

  doc.save(`roundtable_${sessionCode}_transcript.pdf`);
}
