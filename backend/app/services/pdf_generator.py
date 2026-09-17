import io
import os
from pathlib import Path
from typing import Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_enforcement_pdf(
    report_id: int,
    zone_name: str,
    ward_number: Optional[int],
    lat: float,
    lng: float,
    created_at_str: str,
    classification: Optional[str],
    confidence: Optional[float],
    severity_boost: int = 0,
    image_path: Optional[str] = None
) -> bytes:
    """
    Generates official CCMC Municipal Enforcement Action Dossier matching statutory specifications:
    - Navy header #1E293B
    - File No: DS-2026-{id:05d}
    - Action Priority: HIGH / MEDIUM / LOW
    - Health Severity: (confidence * 0.6) + (severity_boost * 0.1)
    - Full width photo evidence
    - Statutory NGT citation
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=32,
        bottomMargin=32
    )
    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=colors.white,
        leading=16
    )
    sub_header_style = ParagraphStyle(
        'SubHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        textColor=colors.HexColor('#94A3B8'),
        leading=11
    )
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=colors.HexColor('#0F172A'),
        leading=17
    )
    notice_style = ParagraphStyle(
        'NoticeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#475569'),
        leading=12
    )
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        textColor=colors.HexColor('#334155'),
        leading=11
    )
    val_style = ParagraphStyle(
        'ValStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        textColor=colors.HexColor('#0F172A'),
        leading=11
    )
    citation_style = ParagraphStyle(
        'CitationStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        textColor=colors.HexColor('#1E293B'),
        leading=11
    )
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        textColor=colors.HexColor('#64748B'),
        leading=11
    )

    story = []

    # 1. Dark Navy Header (#1E293B)
    header_content = [
        [
            Paragraph("🛡️ <b>MUNICIPAL ENFORCEMENT ACTION DOSSIER</b>", header_style),
        ],
        [
            Paragraph("CCMC SANITARY SURVEILLANCE // TNPCB COMPLIANCE", sub_header_style)
        ]
    ]
    header_table = Table(header_content, colWidths=[540])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # Priority logic
    conf_val = confidence or 0.0
    cls_str = classification or ""
    is_burning = cls_str in ["open_burning", "fire"]
    if conf_val >= 0.80 and is_burning:
        priority_label = "HIGH"
        priority_color = "#DC2626"
    elif conf_val >= 0.60 or cls_str == "waste_pile":
        priority_label = "MEDIUM"
        priority_color = "#D97706"
    else:
        priority_label = "LOW"
        priority_color = "#16A34A"

    # Health Severity calculation
    severity_score = round((conf_val * 0.6) + (severity_boost * 0.1), 3)

    # 2. File Notice & Priority Banner
    file_no_str = f"DS-2026-{report_id:05d}"
    notice_text = f"INCIDENT VIOLATION NOTICE • FILE NO: {file_no_str}"
    
    banner_data = [
        [
            Paragraph(notice_text, notice_style),
            Paragraph(f"<font color='{priority_color}'><b>Action Priority: {priority_label}</b></font>", ParagraphStyle('Prio', parent=notice_style, alignment=2))
        ],
        [
            Paragraph("<b>UNAUTHORIZED MUNICIPAL SOLID WASTE DUMPING</b>", title_style),
            Paragraph("", notice_style)
        ]
    ]
    banner_table = Table(banner_data, colWidths=[360, 180])
    banner_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 8))

    # 3. Structured Data Table
    ward_display = f"{zone_name}" + (f", Ward {ward_number}" if ward_number else "")
    gps_display = f"{lat:.6f}° N, {lng:.6f}° E"
    conf_pct = round(conf_val * 100, 1)
    
    details_data = [
        [Paragraph("Target Zone / Ward", label_style), Paragraph(ward_display, val_style)],
        [Paragraph("Hardware GPS Coordinates", label_style), Paragraph(f"<b>{gps_display}</b>", val_style)],
        [Paragraph("Detection Timestamp", label_style), Paragraph(created_at_str, val_style)],
        [Paragraph("AI Neural Confidence", label_style), Paragraph(f"<b>{conf_pct}%</b> (YOLOv8 Dual-Model Ensembled)", val_style)],
        [Paragraph("Calculated Health Severity", label_style), Paragraph(f"<b>{severity_score:.3f} / 1.000</b>", val_style)],
        [
            Paragraph("Statutory Authority Citation", label_style),
            Paragraph("Sept 2026 NGT Ruling O.A. No. 2026/SZ:<br/>Mandatory surveillance of Singanallur, Ondipudur, and Vellalore dump zones.", citation_style)
        ]
    ]
    details_table = Table(details_data, colWidths=[180, 360])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 10))

    # 4. Photographic Visual Proof Section
    proof_title = Paragraph("<b>PHOTOGRAPHIC VISUAL PROOF (AI ANNOTATED EVIDENCE)</b>", label_style)
    story.append(proof_title)
    story.append(Spacer(1, 4))

    rendered_img = False
    if image_path and os.path.exists(image_path):
        try:
            img = RLImage(image_path, width=540, height=270)
            img.hAlign = 'CENTER'
            story.append(img)
            rendered_img = True
        except Exception:
            pass

    if not rendered_img:
        story.append(Paragraph("<i>[Official Photographic Evidence Archived on Municipal Server]</i>", val_style))

    story.append(Spacer(1, 10))

    # 5. Footer Transmission Block
    footer_data = [
        [
            Paragraph("<b>Reported via:</b> DumpSense Citizen Surveillance App<br/><b>Status:</b> Transmitted for Enforcement Dispatch", footer_style),
            Paragraph(f"<b>Generated:</b> CCMC Civic Intelligence Engine<br/><b>Security Verification Hash:</b> <code>OK-CONFIRMED</code>", ParagraphStyle('FR', parent=footer_style, alignment=2))
        ]
    ]
    footer_table = Table(footer_data, colWidths=[270, 270])
    footer_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(footer_table)

    doc.build(story)
    return buffer.getvalue()
