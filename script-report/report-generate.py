import os
import sys
import json
import datetime
from datetime import date
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "reports"))
PICTURES_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "Pictures"))

# CSV paths (UNCHANGED as per your request)
CSV_SITEWISE = os.path.join(REPORTS_DIR, "MD-report-data-Sitewise.csv")
CSV_DAYWISE = os.path.join(REPORTS_DIR, "MD-report-data-Daywise.csv")
CSV_USER = os.path.join(REPORTS_DIR, "MD-report-data-Userwise.csv")

LOGO_PATH = os.path.join(PICTURES_DIR, "download.jpeg")

# Output PDF from Node
OUTPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else "construction_site_report_enhanced.pdf"

# Temporary graph images
TEMP_IMAGES = [f"g{i}.png" for i in range(1, 8)]

# Date info
today = date.today()
current_month = today.month
current_year = today.year

# Colors
PRIMARY_COLOR = colors.HexColor("#003366")
SECONDARY_COLOR = colors.HexColor("#0066CC")
ACCENT_COLOR = colors.HexColor("#FF6B35")
SUCCESS_COLOR = colors.HexColor("#4CAF50")
LIGHT_GRAY = colors.HexColor("#F5F5F5")
MEDIUM_GRAY = colors.HexColor("#E0E0E0")

FOOTER_TEXT = "Contact: Shreyash Dhoot | Abhishek Karad | Mihir Mohite"


# ============================================================
# HEADER & FOOTER
# ============================================================
def add_header_footer(canvas_obj, doc):
    width, height = A4
    canvas_obj.saveState()

    canvas_obj.setFillColor(LIGHT_GRAY)
    canvas_obj.rect(0, height - 90, width, 90, fill=True, stroke=False)

    try:
        canvas_obj.drawImage(LOGO_PATH, 40, height - 75, width=70, height=35, preserveAspectRatio=True, mask='auto')
    except:
        pass

    canvas_obj.setFont("Helvetica-Bold", 14)
    canvas_obj.setFillColor(PRIMARY_COLOR)
    canvas_obj.drawString(130, height - 45, "Construction Site Management")
    canvas_obj.setFont("Helvetica", 10)
    canvas_obj.setFillColor(colors.HexColor("#666666"))
    canvas_obj.drawString(130, height - 62, f"Monthly Report - {today.strftime('%B')} {current_year}")

    canvas_obj.setStrokeColor(PRIMARY_COLOR)
    canvas_obj.setLineWidth(2)
    canvas_obj.line(30, height - 90, width - 30, height - 90)

    canvas_obj.setFillColor(PRIMARY_COLOR)
    canvas_obj.rect(0, 0, width, 60, fill=True, stroke=False)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.drawString(40, 35, FOOTER_TEXT)

    page_text = f"{doc.page}"
    canvas_obj.setFont("Helvetica-Bold", 10)
    canvas_obj.setFillColor(SECONDARY_COLOR)
    canvas_obj.circle(width - 50, 30, 15, fill=True, stroke=False)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.drawString(width - 50 - 3, 26, page_text)

    canvas_obj.restoreState()


# ============================================================
# CHART HELPERS
# ============================================================

def plot_bar_chart(df, title, columns, ylabel, filename):
    plt.style.use('seaborn-v0_8-darkgrid')
    fig, ax = plt.subplots(figsize=(9, 4.5), facecolor='white')

    x = np.arange(len(df))
    width = 0.75 / len(columns)
    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']

    for i, col in enumerate(columns):
        offset = (i - len(columns)/2 + 0.5) * width
        bars = ax.bar(x + offset, df[col], width, color=colors_list[i % len(colors_list)])
        for bar in bars:
            h = bar.get_height()
            if h > 0:
                ax.text(bar.get_x() + bar.get_width()/2., h, f'{int(h)}', ha='center', va='bottom', fontsize=7)

    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(os.path.join(BASE_DIR, filename), dpi=200)
    plt.close()


def plot_line_chart(df, title, columns, ylabel, filename):
    plt.style.use('seaborn-v0_8-darkgrid')
    fig, ax = plt.subplots(figsize=(9, 4.5))

    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']

    for i, col in enumerate(columns):
        ax.plot(df['date'], df[col], marker='o', linewidth=2, color=colors_list[i % len(colors_list)])

    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(os.path.join(BASE_DIR, filename), dpi=200)
    plt.close()


def plot_pie_chart(labels, values, title, filename):
    plt.style.use('seaborn-v0_8-pastel')
    fig, ax = plt.subplots(figsize=(8, 6))
    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']

    ax.pie(values, labels=labels, autopct='%1.1f%%', colors=colors_list, startangle=90)
    ax.set_title(title)
    plt.tight_layout()
    plt.savefig(os.path.join(BASE_DIR, filename), dpi=200)
    plt.close()


# ============================================================
# INSIGHTS
# ============================================================
def generate_insights(df_Sitewise, df_Daywise, df_User):
    total_raised = df_Sitewise['total_raised'].sum()
    total_solved = df_Sitewise['total_solved'].sum()
    avg_pending = df_Sitewise['total_pending'].mean()
    resolution_rate = (total_solved / total_raised * 100) if total_raised > 0 else 0

    issue_totals = {
        'Safety Compliance': df_Sitewise['safety_compliance_raised'].sum(),
        'Design Conflicts': df_Sitewise['design_conflicts_raised'].sum(),
        'Resource Blockers': df_Sitewise['resource_blockers_raised'].sum(),
        'Workflow Issues': df_Sitewise['workflow_issues_raised'].sum(),
        'Miscellaneous': df_Sitewise['miscellaneous_raised'].sum()
    }

    most_common_issue = max(issue_totals, key=issue_totals.get)

    resolved_issues = df_Daywise[df_Daywise['resolved'] == 'Yes']
    avg_resolution_time = resolved_issues['time_to_resolve_hrs'].mean() if len(resolved_issues) > 0 else 0

    total_logins = df_User['login_count'].sum()
    avg_time_spent = df_User['time_spent'].mean()
    most_active_user = df_User.groupby('username')['time_spent'].sum().idxmax()

    return {
        "overview": f"During <b>{today.strftime('%B')} {current_year}</b>, <b>{total_raised}</b> issues were raised...",
        "issue_breakdown": f"{most_common_issue} was most frequent...",
        "resolution": f"Average resolution time {avg_resolution_time:.1f} hrs.",
        "engagement": f"Total logins {total_logins}",
        "recommendations": "Bi-weekly audits, Weekly BIM meetings...",
        "kpis": {
            "total_raised": total_raised,
            "total_solved": total_solved,
            "resolution_rate": resolution_rate,
            "avg_pending": avg_pending,
            "avg_resolution_hours": avg_resolution_time,
            "total_logins": total_logins,
            "avg_session_minutes": avg_time_spent
        }
    }


# ============================================================
# PDF BUILDER
# ============================================================
def build_pdf(df_Sitewise, df_Daywise, df_User, dynamic_insights):
    styles = getSampleStyleSheet()
    story = []

    # STYLES (unchanged)
    title_style = ParagraphStyle("CustomTitle", parent=styles["Heading1"], fontSize=20,
                                 textColor=PRIMARY_COLOR, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=11,
                                    alignment=TA_CENTER)
    section_title = ParagraphStyle("SectionTitle", parent=styles["Heading2"], fontSize=14, textColor=PRIMARY_COLOR)
    subsection_title = ParagraphStyle("SubsectionTitle", parent=styles["Heading3"], fontSize=12,
                                      textColor=SECONDARY_COLOR)
    body_style = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=16)

    insights = generate_insights(df_Sitewise, df_Daywise, df_User)

    # ===== COVER PAGE =====
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("CONSTRUCTION SITE<br/>MONTHLY REPORT", title_style))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(
        f"<b>Period:</b> {today.strftime('%B')} {current_year}<br/>"
        f"<b>Generated On:</b> {today.strftime('%B %d, %Y')}",
        subtitle_style))
    story.append(PageBreak())

    # ===== SECTION 1 =====
    story.append(Paragraph("1. ISSUES ANALYSIS", section_title))
    story.append(Paragraph("1.1 Issues Raised by Category", subsection_title))

    issue_cols = ['safety_compliance_raised', 'design_conflicts_raised',
                  'resource_blockers_raised', 'workflow_issues_raised',
                  'miscellaneous_raised']

    plot_bar_chart(df_Sitewise, "Daily Issues Raised", issue_cols, "Count", "g1.png")
    story.append(Image(os.path.join(BASE_DIR, "g1.png"), width=5.5 * inch, height=2.75 * inch))

    story.append(Paragraph(dynamic_insights.get("Issue_raised_analysis", ""), body_style))

    # ===== SECTION 2 =====
    story.append(Paragraph("1.2 Issues Raised vs Resolved", subsection_title))
    plot_line_chart(df_Sitewise, "Trend", ['total_raised', 'total_solved'], "Count", "g2.png")
    story.append(Image(os.path.join(BASE_DIR, "g2.png"), width=5.5 * inch, height=2.75 * inch))
    story.append(Paragraph(dynamic_insights.get("issue_raised_and_solved_analysis", ""), body_style))

    # ===== SECTION 3 =====
    story.append(Paragraph("1.3 Pending Issues Trend", subsection_title))
    plot_line_chart(df_Sitewise, "Pending", ['total_pending'], "Pending", "g3.png")
    story.append(Image(os.path.join(BASE_DIR, "g3.png"), width=5.5 * inch, height=2.75 * inch))
    story.append(Paragraph(dynamic_insights.get("pending_trend_analysis", ""), body_style))

    # ===== SECTION 4 =====
    story.append(Paragraph("1.4 Issue Distribution", subsection_title))
    issue_totals = [df_Sitewise[col].sum() for col in issue_cols]
    issue_labels = ['Safety', 'Design', 'Resource', 'Workflow', 'Misc']

    plot_pie_chart(issue_labels, issue_totals, "Issue Types", "g4.png")
    story.append(Image(os.path.join(BASE_DIR, "g4.png"), width=4.5 * inch, height=3.4 * inch))
    story.append(Paragraph(dynamic_insights.get("issue_distribution_analysis", ""), body_style))

    # ===== SECTION 5 =====
    story.append(Paragraph("2. RESOLUTION PERFORMANCE", section_title))

    solved_cols = ['safety_compliance_solved', 'design_conflicts_solved',
                   'resource_blockers_solved', 'workflow_issues_solved',
                   'miscellaneous_solved']

    plot_bar_chart(df_Sitewise, "Issues Resolved", solved_cols, "Count", "g5.png")
    story.append(Image(os.path.join(BASE_DIR, "g5.png"), width=5.5 * inch, height=2.75 * inch))
    story.append(Paragraph(insights['resolution'], body_style))

    # ===== USER ENGAGEMENT =====
    story.append(Paragraph("3. USER ENGAGEMENT", section_title))
    user_daily = df_User.groupby('date').agg({'login_count': 'sum', 'time_spent': 'sum'}).reset_index()

    plot_line_chart(user_daily, "Daily Logins", ['login_count'], "Logins", "g6.png")
    story.append(Image(os.path.join(BASE_DIR, "g6.png"), width=5.5 * inch, height=2.75 * inch))
    story.append(Paragraph(insights['engagement'], body_style))

    # ===== TIME SPENT =====
    story.append(Paragraph("3.1 Platform Usage Time", subsection_title))
    plot_line_chart(user_daily, "Time Spent", ['time_spent'], "Minutes", "g7.png")
    story.append(Image(os.path.join(BASE_DIR, "g7.png"), width=5.5 * inch, height=2.75 * inch))

    story.append(Paragraph(
        f"Total: <b>{df_User['time_spent'].sum():.0f} min</b> "
        f"({df_User['time_spent'].sum()/60:.1f} hrs)", body_style))

    # ===== RECOMMENDATIONS =====
    story.append(Paragraph("4. RECOMMENDATIONS", section_title))
    story.append(Paragraph(insights['recommendations'], body_style))

    return story


# ============================================================
# MAIN
# ============================================================
def generate_pdf_report():
    print("Loading CSVs...")

    df_Sitewise = pd.read_csv(CSV_SITEWISE)
    df_Daywise = pd.read_csv(CSV_DAYWISE)
    df_User = pd.read_csv(CSV_USER)

    df_Sitewise['date'] = pd.to_datetime(df_Sitewise['date'])
    df_Daywise['date'] = pd.to_datetime(df_Daywise['date'])
    df_User['date'] = pd.to_datetime(df_User['date'])

    df_Sitewise = df_Sitewise[(df_Sitewise['date'].dt.month == current_month)]
    df_Daywise = df_Daywise[(df_Daywise['date'].dt.month == current_month)]
    df_User = df_User[(df_User['date'].dt.month == current_month)]

    dynamic_insights = {}
    if len(sys.argv) > 2:
        try:
            dynamic_insights = json.loads(sys.argv[2])
        except:
            dynamic_insights = {}

    story = build_pdf(df_Sitewise, df_Daywise, df_User, dynamic_insights)

    print("Building PDF:", OUTPUT_FILE)
    doc = SimpleDocTemplate(OUTPUT_FILE, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=100, bottomMargin=80)
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)

    # Delete temporary graphs
    for img in TEMP_IMAGES:
        fp = os.path.join(BASE_DIR, img)
        if os.path.exists(fp):
            os.remove(fp)

    print("PDF Generated Successfully:", OUTPUT_FILE)


if __name__ == "__main__":
    generate_pdf_report()
