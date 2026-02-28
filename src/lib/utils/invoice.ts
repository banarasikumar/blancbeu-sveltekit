import type { Booking } from '$lib/stores/adminData';

// ═══════════════════════════════════════════
//   MODULE-LEVEL CACHE — Persist across calls
//   Fonts, SVG background, and libraries are
//   fetched once and reused for all invoices
// ═══════════════════════════════════════════

let cachedFonts: { abhayaBold: string | null; montserratReg: string | null; montserratBold: string | null } | null = null;
let cachedSvgBgDataUrl: string | null = null;
let cachedJsPDF: any = null;
let cachedAutoTable: any = null;
let cachedQRCode: any = null;

export async function generateAndShareInvoice(params: {
    booking: Booking;
    services: { name: string; price: number; originalPrice?: number }[];
    totalAmount: number;
    discountAmount?: number;
    extraCharge?: number;
    couponCode?: string | null;
}) {
    const {
        booking,
        services,
        totalAmount,
        discountAmount = 0,
        extraCharge = 0,
        couponCode
    } = params;

    // 1. Load jsPDF + autoTable (cached after first load)
    if (!cachedJsPDF || !cachedAutoTable) {
        const [jsPDFModule, autoTableModule] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]);
        cachedJsPDF = jsPDFModule.default;
        cachedAutoTable = autoTableModule.default;
    }

    const jsPDF = cachedJsPDF;
    const autoTable = cachedAutoTable;
    const doc = new jsPDF({ format: 'a4', unit: 'pt' });

    const pageWidth = doc.internal.pageSize.getWidth();   // ~595pt
    const pageHeight = doc.internal.pageSize.getHeight();  // ~842pt

    // ═══════════════════════════════════════════
    //   FONTS — Fetch & embed custom TTF fonts
    //   Cached after first load for instant reuse
    // ═══════════════════════════════════════════

    if (!cachedFonts) {
        const fetchBase64Font = async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
            const buf = await res.arrayBuffer();
            const bytes = new Uint8Array(buf);
            // Chunked base64 conversion — ~100x faster than byte-by-byte
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        };

        const [abhayaBold, montserratReg, montserratBold] = await Promise.all([
            fetchBase64Font('/fonts/AbhayaLibre-Bold.ttf').catch(() => null),
            fetchBase64Font('/fonts/Montserrat-Regular.ttf').catch(() => null),
            fetchBase64Font('/fonts/Montserrat-Bold.ttf').catch(() => null)
        ]);
        cachedFonts = { abhayaBold, montserratReg, montserratBold };
    }

    const { abhayaBold, montserratReg, montserratBold } = cachedFonts;

    if (abhayaBold) {
        doc.addFileToVFS('AbhayaLibre-Bold.ttf', abhayaBold);
        doc.addFont('AbhayaLibre-Bold.ttf', 'AbhayaLibre', 'bold');
    }
    if (montserratReg) {
        doc.addFileToVFS('Montserrat-Regular.ttf', montserratReg);
        doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
    }
    if (montserratBold) {
        doc.addFileToVFS('Montserrat-Bold.ttf', montserratBold);
        doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
    }

    const headingFont = abhayaBold ? 'AbhayaLibre' : 'helvetica';
    const bodyFont = montserratReg ? 'Montserrat' : 'helvetica';

    // ═══════════════════════════════════════════
    //   SVG BACKGROUND — Render via Canvas (High-DPI)
    // ═══════════════════════════════════════════

    // SVG background — cached as PNG data URL after first render
    if (!cachedSvgBgDataUrl) {
        try {
            const svgRes = await fetch('/invoice-bg-vector.svg');
            if (svgRes.ok) {
                const svgText = await svgRes.text();
                const scale = 3;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(pageWidth * scale);
                canvas.height = Math.round(pageHeight * scale);
                const ctx = canvas.getContext('2d')!;
                ctx.scale(scale, scale);

                const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const blobUrl = URL.createObjectURL(svgBlob);

                await new Promise<void>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, pageWidth, pageHeight);
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };
                    img.onerror = (e) => {
                        URL.revokeObjectURL(blobUrl);
                        reject(e);
                    };
                    img.src = blobUrl;
                });

                cachedSvgBgDataUrl = canvas.toDataURL('image/png');
            }
        } catch (err) {
            console.warn('SVG background failed, using plain color fallback', err);
        }
    }

    if (cachedSvgBgDataUrl) {
        doc.addImage(cachedSvgBgDataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    } else {
        doc.setFillColor(254, 242, 246);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
    }

    // ═══════════════════════════════════════════
    //   COORDINATE SYSTEM — Maps SVG coords → PDF coords
    //   Cropped viewBox: "81.22 72.65 612.28 858.9"
    // ═══════════════════════════════════════════

    const ox = 81.22, oy = 72.65, vw = 612.28, vh = 858.9;
    const px = (svgX: number) => (svgX - ox) * pageWidth / vw;
    const py = (svgY: number) => (svgY - oy) * pageHeight / vh;

    // ═══════════════════════════════════════════
    //   BRAND — Larger "BLANCBEU" top-right
    // ═══════════════════════════════════════════

    doc.setFont(headingFont, 'bold');
    doc.setFontSize(26);
    doc.setTextColor(51, 51, 51);
    doc.text('BLANCBEU', px(640), py(140), { align: 'right' });

    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('PREMIUM SALON & SPA', px(640), py(160), { align: 'right' });

    // ═══════════════════════════════════════════
    //   "INVOICE" TITLE — Right-aligned
    // ═══════════════════════════════════════════

    doc.setFont(headingFont, 'bold');
    doc.setFontSize(42);
    doc.setTextColor(64, 64, 64);
    doc.text('INVOICE', px(600), py(247), { align: 'right' });

    // ═══════════════════════════════════════════
    //   META — Invoice No, Date (left) / Client (right)
    // ═══════════════════════════════════════════

    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(64, 64, 64);

    const invoiceNum = `INV-${String(booking.id).slice(0, 8).toUpperCase()}`;
    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const metaY = py(305);
    doc.text(`INVOICE NO.: ${invoiceNum}`, px(135), metaY);
    doc.text(`DATE: ${dateStr}`, px(135), metaY + 13);

    // Client info — split into separate lines
    const clientName = booking.userName || 'Valued Client';
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(64, 64, 64);
    doc.text('INVOICE TO:', px(640), metaY, { align: 'right' });
    doc.text(clientName.toUpperCase(), px(640), metaY + 14, { align: 'right' });

    if (booking.userPhone) {
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(booking.userPhone, px(640), metaY + 27, { align: 'right' });
    }

    // ═══════════════════════════════════════════
    //   SERVICES TABLE
    //   Header:  Pink #FAAAC0
    //   Odd rows: White #FFFFFF
    //   Even rows: Light pink #FEE8F0
    //   Separators: Subtle 0.3pt lines
    // ═══════════════════════════════════════════

    const tableStartY = py(363);
    const tableLeft = px(135);
    const tableRight = px(639);

    // Compact currency formatter: ₹56,415 or ₹999.50 (Indian comma separators)
    const fmt = (n: number) => `\u20B9${n.toLocaleString('en-IN')}`;

    const tableBody = services.map((s) => [
        s.name,
        fmt(s.originalPrice || s.price),
        fmt(s.price)
    ]);

    autoTable(doc, {
        startY: tableStartY,
        head: [['SERVICE', 'MRP', 'SPECIAL PRICE']],
        body: tableBody,
        theme: 'plain',
        headStyles: {
            fillColor: [250, 170, 192],   // Pink #FAAAC0
            textColor: [64, 64, 64],
            font: bodyFont,
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'left',
            cellPadding: { top: 8, bottom: 8, left: 12, right: 12 }
        },
        bodyStyles: {
            textColor: [60, 60, 60],
            font: bodyFont,
            fontSize: 10,
            fillColor: [248, 170, 192],   // Warm pink #F8AAC0 (1st, 3rd, 5th rows)
            cellPadding: { top: 10, bottom: 10, left: 12, right: 12 }
        },
        alternateRowStyles: {
            fillColor: [253, 245, 248]   // Very light pink #FDF5F8 (2nd, 4th, 6th rows)
        },
        styles: {
            lineWidth: 0.3,
            lineColor: [230, 210, 215]   // Subtle separator lines
        },
        columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { cellWidth: 90, halign: 'right' },
            2: { cellWidth: 90, halign: 'right' }
        },
        margin: { left: tableLeft, right: pageWidth - tableRight }
    });

    // @ts-ignore
    let finalY = doc.lastAutoTable?.finalY || 450;

    // ═══════════════════════════════════════════
    //   TOTALS (right) & NOTES + PAYMENT (left)
    // ═══════════════════════════════════════════

    finalY += 35;
    const leftCol = px(135);

    // — LEFT: UPI QR Code (top) —
    let leftYOffset = finalY;
    try {
        if (!cachedQRCode) cachedQRCode = (await import('qrcode')).default;
        const QRCode = cachedQRCode;
        const upiUri = `upi://pay?pa=Q714475106@ybl&pn=BlancBeu Beauty Salon&mc=0000&mode=02&purpose=00&am=${totalAmount}&cu=INR&tn=${invoiceNum}`;
        const qrDataUrl = await QRCode.toDataURL(upiUri, {
            width: 200,
            margin: 1,
            color: { dark: '#333333', light: '#FFFFFF' }
        });

        const qrSize = 100; // pt — bigger QR
        const qrX = leftCol;
        const qrY = leftYOffset;

        // "Scan to Pay" title above QR
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(64, 64, 64);
        doc.text('Scan to Pay', qrX + qrSize / 2, qrY - 6, { align: 'center' });

        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        // Info note for bills over ₹2,000 — displayed to the RIGHT of the QR
        if (totalAmount > 2000) {
            const noteX = qrX + qrSize + 12;
            let noteY = qrY + 6;
            const iconR = 3;
            const textIndent = noteX + iconR * 2 + 4;
            const maxTextW = pageWidth / 2 - textIndent - 10; // available width for text

            doc.setFont(bodyFont, 'bold');
            doc.setFontSize(7);
            doc.setTextColor(180, 60, 90);
            doc.text('Notice:', noteX, noteY);
            noteY += 12;

            const bulletItems = [
                { type: 'red', text: "QR screenshot won't work" },
                { type: 'none', text: 'as its \u20B92,000+ amount.' },
                { type: 'green', text: 'Ask Stylist to show QR' },
                { type: 'green', text: 'Pay by copying UPI ID' },
                { type: 'green', text: 'Scan from another phone' }
            ];

            // Set rounded line caps for clean icon drawing
            doc.setLineCap(1);  // 1 = round
            doc.setLineJoin(1); // 1 = round

            for (const item of bulletItems) {
                const cx = noteX + iconR;
                const cy = noteY - 2;

                if (item.type === 'red') {
                    // Red circle with white X
                    doc.setFillColor(220, 60, 60);
                    doc.circle(cx, cy, iconR, 'F');
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(0.9);
                    doc.line(cx - 1.3, cy - 1.3, cx + 1.3, cy + 1.3);
                    doc.line(cx + 1.3, cy - 1.3, cx - 1.3, cy + 1.3);
                    doc.setFont(bodyFont, 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(140, 80, 100);
                    doc.text(item.text, textIndent, noteY);
                } else if (item.type === 'green') {
                    // Green circle with white checkmark
                    doc.setFillColor(34, 160, 70);
                    doc.circle(cx, cy, iconR, 'F');
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(0.9);
                    // Draw check as a single path (short down-right, then long up-right)
                    doc.line(cx - 1.4, cy - 0.2, cx - 0.2, cy + 1.3);
                    doc.line(cx - 0.2, cy + 1.3, cx + 1.6, cy - 1.3);
                    doc.setFont(bodyFont, 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(140, 80, 100);
                    doc.text(item.text, textIndent, noteY);
                } else {
                    // Continuation line (no icon, indented under previous)
                    doc.setFont(bodyFont, 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(140, 80, 100);
                    doc.text('  ' + item.text, textIndent, noteY);
                }
                noteY += 10;
            }

            // Reset line cap to default
            doc.setLineCap(0);
            doc.setLineJoin(0);
        }

        // "BlancBeu Beauty Salon" below QR
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(64, 64, 64);
        doc.text('BlancBeu Beauty Salon', qrX + qrSize / 2, qrY + qrSize + 10, { align: 'center' });

        // "Rina Kumari" below salon name
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(64, 64, 64);
        doc.text('Rina Kumari', qrX + qrSize / 2, qrY + qrSize + 22, { align: 'center' });

        // UPI ID below name
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text('UPI ID: Q714475106@ybl', qrX + qrSize / 2, qrY + qrSize + 33, { align: 'center' });

        leftYOffset = qrY + qrSize + 70;
    } catch (err) {
        console.warn('QR code generation failed:', err);
    }

    // — LEFT: Payment Info (below QR) —
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(64, 64, 64);
    doc.text('PAYMENT INFO:', leftCol, leftYOffset);

    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const payLines = doc.splitTextToSize(
        'Payment accepted via Cash, UPI, Card, Net Banking, Cryptocurrency, E-Rupi & Pay Later.',
        200
    );
    doc.text(payLines, leftCol, leftYOffset + 14);

    // — LEFT: Terms & Conditions (below Payment Info) —
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(64, 64, 64);
    doc.text('TERMS & CONDITIONS', leftCol, leftYOffset + 65);

    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const termsLines = doc.splitTextToSize(
        'Services are non-refundable. Prices include all applicable charges. Please verify details before leaving.',
        200
    );
    doc.text(termsLines, leftCol, leftYOffset + 79);

    // — RIGHT: Totals —
    const totalsLabelX = px(400);
    const totalsValueX = px(639);
    const subtotal = services.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(64, 64, 64);

    doc.text('SUBTOTAL', totalsLabelX, finalY);
    doc.text(fmt(subtotal), totalsValueX, finalY, { align: 'right' });

    finalY += 18;
    const gstRate = 18;
    const gstAmount = Math.round(subtotal - subtotal / (1 + gstRate / 100));
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    doc.text(`GST @ ${gstRate}% (Included)`, totalsLabelX, finalY);
    doc.text(fmt(gstAmount), totalsValueX, finalY, { align: 'right' });
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);

    if (extraCharge > 0) {
        finalY += 18;
        doc.text('OTHER CHARGES', totalsLabelX, finalY);
        doc.text(fmt(extraCharge), totalsValueX, finalY, { align: 'right' });
    }

    if (discountAmount > 0) {
        finalY += 18;
        doc.text(`EXTRA DISCOUNT${couponCode ? ` (${couponCode})` : ''}`, totalsLabelX, finalY);
        doc.text(`- ${fmt(discountAmount)}`, totalsValueX, finalY, { align: 'right' });
    }

    finalY += 35;
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(64, 64, 64);
    doc.text('GRAND TOTAL', totalsLabelX, finalY);
    doc.text(fmt(totalAmount), totalsValueX, finalY, { align: 'right' });

    // ═══════════════════════════════════════════
    //   FOOTER — Impressive call-to-action text
    // ═══════════════════════════════════════════

    // Helper: Render a heart as a canvas image for PDF (fonts don't have the glyph)
    const renderHeartImage = (size: number, color: string): string => {
        const c = document.createElement('canvas');
        const s = size * 4; // high-DPI
        c.width = s;
        c.height = s;
        const ctx = c.getContext('2d')!;
        ctx.scale(4, 4);
        ctx.fillStyle = color;
        ctx.beginPath();
        const w = size, h = size;
        const topY = h * 0.35;
        ctx.moveTo(w / 2, h * 0.85);
        ctx.bezierCurveTo(w * 0.1, h * 0.55, -w * 0.05, topY * 0.6, w * 0.25, topY * 0.35);
        ctx.bezierCurveTo(w * 0.4, 0, w / 2, topY * 0.5, w / 2, topY);
        ctx.moveTo(w / 2, h * 0.85);
        ctx.bezierCurveTo(w * 0.9, h * 0.55, w * 1.05, topY * 0.6, w * 0.75, topY * 0.35);
        ctx.bezierCurveTo(w * 0.6, 0, w / 2, topY * 0.5, w / 2, topY);
        ctx.fill();
        return c.toDataURL('image/png');
    };

    const heartImg = renderHeartImage(18, '#d63384');

    // Line 1: "You came beautiful. You leave radiant." + heart (close to text)
    doc.setFont(headingFont, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(140, 45, 80);
    const line1Text = 'You came beautiful. You leave radiant.';
    const line1Width = doc.getTextWidth(line1Text);
    const heartSize1 = 11;
    const line1TotalW = line1Width + 3 + heartSize1;
    const line1X = (pageWidth - line1TotalW) / 2;
    const line1Y = pageHeight - 48;
    doc.text(line1Text, line1X, line1Y);
    doc.addImage(heartImg, 'PNG', line1X + line1Width + 3, line1Y - heartSize1 + 2, heartSize1, heartSize1);

    // Line 2: "We can't wait to pamper you again  •  Book your next visit at" + [blancbeu.in pill]
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 90, 115);

    const footerY = pageHeight - 30;
    const beforeLink = 'We can\u2019t wait to pamper you again  \u2022  Book your next visit at ';
    const linkText = 'blancbeu.in';

    // Measure widths
    const beforeWidth = doc.getTextWidth(beforeLink);
    doc.setFont(bodyFont, 'bold');
    const linkWidth = doc.getTextWidth(linkText);
    doc.setFont(bodyFont, 'normal');
    const pillPadH = 5; // horizontal padding inside pill
    const totalWidth = beforeWidth + (linkWidth + pillPadH * 2);
    const startX = (pageWidth - totalWidth) / 2;

    // Text before link
    doc.setFont(bodyFont, 'normal');
    doc.setTextColor(150, 90, 115);
    doc.text(beforeLink, startX, footerY);

    // Pill-shaped background behind link (vertically centered on text)
    const pillX = startX + beforeWidth;
    const pillW = linkWidth + pillPadH * 2;
    const pillH = 12;
    const pillY = footerY - 8.5; // aligned to sit snugly around text
    const pillR = pillH / 2;

    doc.setFillColor(248, 220, 230); // Warm blush pink
    doc.roundedRect(pillX, pillY, pillW, pillH, pillR, pillR, 'F');

    // Subtle pill border
    doc.setDrawColor(230, 160, 185);
    doc.setLineWidth(0.4);
    doc.roundedRect(pillX, pillY, pillW, pillH, pillR, pillR, 'S');

    // Link text (bold, rich rose)
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(190, 30, 90);
    doc.textWithLink(linkText, pillX + pillPadH, footerY, { url: 'https://blancbeu.in' });

    // Underline under link text
    const underlineY = footerY + 1.5;
    doc.setDrawColor(190, 30, 90);
    doc.setLineWidth(0.5);
    doc.line(pillX + pillPadH, underlineY, pillX + pillPadH + linkWidth, underlineY);

    // ═══════════════════════════════════════════
    //   SHARE PDF VIA SHARE SHEET
    // ═══════════════════════════════════════════

    const fileName = `Invoice_${(booking.userName || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Use Web Share API to share the PDF file (opens native share sheet on mobile)
    // Try share directly — canShare may be undefined on HTTP dev servers
    try {
        await navigator.share({
            files: [pdfFile],
            title: `Invoice - ${booking.userName || 'Client'}`,
            text: `Invoice from Blancbeu - ${booking.userName || 'Client'}`
        });
    } catch (shareErr: any) {
        // If sharing is not supported or user cancelled, fall back to download
        if (shareErr?.name === 'AbortError') {
            // User cancelled — do nothing
        } else {
            // Safe download that won't navigate the page away
            console.warn('Share not available, downloading PDF:', shareErr);
            const blobUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            // Clean up blob URL after a short delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
    }
}

// ═══════════════════════════════════════════
//   START WHATSAPP CHAT — Opens WhatsApp app
//   with customer's number and text summary
// ═══════════════════════════════════════════

export function startWhatsAppChat(params: {
    booking: Booking;
    services: { name: string; price: number; originalPrice?: number }[];
    totalAmount: number;
    discountAmount?: number;
    extraCharge?: number;
}) {
    const { booking, services, totalAmount, discountAmount = 0, extraCharge = 0 } = params;

    let msg = `*Invoice from Blancbeu*\nHello ${booking.userName || ''},\nHere is your service summary:\n\n`;
    services.forEach((s) => msg += `- ${s.name}: Rs.${s.price}\n`);
    if (extraCharge > 0) msg += `Other Charges: Rs.${extraCharge}\n`;
    if (discountAmount > 0) msg += `Extra Discount: -Rs.${discountAmount}\n`;
    msg += `\n*Total Amount: Rs.${totalAmount}*\n\nThank you for choosing Blancbeu! 💖`;

    const encodedMsg = encodeURIComponent(msg);
    const phone = booking.userPhone ? booking.userPhone.replace(/\D/g, '') : '';

    // Use whatsapp:// scheme to launch WhatsApp app directly (not browser)
    const waAppUrl = phone
        ? `whatsapp://send?phone=${phone}&text=${encodedMsg}`
        : `whatsapp://send?text=${encodedMsg}`;

    // Anchor click properly triggers app intent on PWA
    const waLink = document.createElement('a');
    waLink.href = waAppUrl;
    waLink.style.display = 'none';
    document.body.appendChild(waLink);
    waLink.click();
    document.body.removeChild(waLink);
}
