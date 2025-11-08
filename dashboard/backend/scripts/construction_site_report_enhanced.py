import io
import random
import datetime
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from datetime import date, timedelta

# ===============================
# CONFIGURATION
# ===============================
LOGO_PATH = "Pictures/download.jpeg"
OUTPUT_FILE = "construction_site_report_enhanced.pdf"
FOOTER_TEXT = "Contact: Shreyash Dhoot: 7666597668 | Abhishek Karad: 89238XXXX | Mihir Mohite: 82913XXXX"
today = date.today()
current_month = today.strftime("%B")
current_year = today.year

# Enhanced color palette
PRIMARY_COLOR = colors.HexColor("#003366")
SECONDARY_COLOR = colors.HexColor("#0066CC")
ACCENT_COLOR = colors.HexColor("#FF6B35")
SUCCESS_COLOR = colors.HexColor("#4CAF50")
LIGHT_GRAY = colors.HexColor("#F5F5F5")
MEDIUM_GRAY = colors.HexColor("#E0E0E0")

# ===============================
# DEMO DATA GENERATION
# ===============================
def generate_construction_demo_data():
    """Generate realistic construction site data"""
    start_date = date(current_year, today.month, 1)
    num_days = (today - start_date).days + 1
    dates = [start_date + timedelta(days=i) for i in range(num_days)]
    
    issues_data = []
    for i, d in enumerate(dates):
        weekday = d.weekday()
        multiplier = 0.5 if weekday >= 5 else 1.0
        
        issues_data.append({
            'date': d,
            'site_code': 'SITE-001',
            'name': 'Downtown Construction Project',
            'safety_compliance_raised': int(random.randint(1, 6) * multiplier),
            'design_conflicts_raised': int(random.randint(0, 5) * multiplier),
            'resource_blockers_raised': int(random.randint(0, 4) * multiplier),
            'workflow_issues_raised': int(random.randint(1, 5) * multiplier),
            'miscellaneous_raised': int(random.randint(0, 3) * multiplier),
            'safety_compliance_solved': max(0, int(random.randint(1, 6) * multiplier) - random.randint(-1, 2)),
            'design_conflicts_solved': max(0, int(random.randint(0, 5) * multiplier) - random.randint(-1, 2)),
            'resource_blockers_solved': max(0, int(random.randint(0, 4) * multiplier) - random.randint(-1, 2)),
            'workflow_issues_solved': max(0, int(random.randint(1, 5) * multiplier) - random.randint(-1, 2)),
            'miscellaneous_solved': max(0, int(random.randint(0, 3) * multiplier) - random.randint(-1, 1)),
        })
    
    df_issues = pd.DataFrame(issues_data)
    df_issues['total_raised'] = df_issues[['safety_compliance_raised', 'design_conflicts_raised', 
                                           'resource_blockers_raised', 'workflow_issues_raised', 
                                           'miscellaneous_raised']].sum(axis=1)
    df_issues['total_solved'] = df_issues[['safety_compliance_solved', 'design_conflicts_solved', 
                                           'resource_blockers_solved', 'workflow_issues_solved', 
                                           'miscellaneous_solved']].sum(axis=1)
    df_issues['total_pending'] = df_issues['total_raised'].cumsum() - df_issues['total_solved'].cumsum()
    df_issues['total_pending'] = df_issues['total_pending'].clip(lower=0)
    
    # Individual issues
    individual_issues = []
    issue_types = ['safety_compliance', 'design_conflicts', 'resource_blockers', 'workflow_issues', 'miscellaneous']
    for i in range(80):
        created_date = random.choice(dates)
        resolved = random.random() > 0.25
        if resolved:
            days_to_resolve = random.choices([1, 2, 3, 4, 5, 6, 7], weights=[30, 25, 20, 12, 8, 3, 2])[0]
            resolved_date = created_date + timedelta(days=days_to_resolve)
            solving_time = days_to_resolve * 24 + random.randint(-12, 12)
            resolved_status = 'Resolved'
        else:
            resolved_date, solving_time, resolved_status = None, None, 'Pending'
        
        individual_issues.append({
            'date': created_date, 'sitecode': 'SITE-001', 'sitename': 'Downtown Construction Project',
            'issue_type': random.choice(issue_types), 'createdAt': created_date,
            'resolvedAt': resolved_date, 'Solving_time': solving_time, 'resolved_status': resolved_status
        })
    
    df_individual = pd.DataFrame(individual_issues)
    
    # User activity
    users = ['John_Smith', 'Sarah_Johnson', 'Mike_Williams', 'Emily_Brown', 'David_Jones']
    user_activity = []
    for d in dates:
        for user in users:
            if random.random() > 0.15:
                user_activity.append({
                    'date': d, 'username': user,
                    'login_count': random.randint(2, 12),
                    'time_spent': random.randint(45, 420)
                })
    
    df_users = pd.DataFrame(user_activity)
    return df_issues, df_individual, df_users

# ===============================
# ENHANCED HEADER & FOOTER
# ===============================
def add_header_footer(canvas_obj, doc):
    """Enhanced header and footer"""
    width, height = A4
    canvas_obj.saveState()
    
    # Header background
    canvas_obj.setFillColor(LIGHT_GRAY)
    canvas_obj.rect(0, height - 90, width, 90, fill=True, stroke=False)
    
    try:
        canvas_obj.drawImage(LOGO_PATH, 40, height - 75, width=70, height=35, 
                           preserveAspectRatio=True, mask='auto')
    except:
        pass
    
    canvas_obj.setFont("Helvetica-Bold", 14)
    canvas_obj.setFillColor(PRIMARY_COLOR)
    canvas_obj.drawString(130, height - 45, "Construction Site Management")
    canvas_obj.setFont("Helvetica", 10)
    canvas_obj.setFillColor(colors.HexColor("#666666"))
    canvas_obj.drawString(130, height - 62, f"Monthly Report - {current_month} {current_year}")
    
    canvas_obj.setStrokeColor(PRIMARY_COLOR)
    canvas_obj.setLineWidth(2)
    canvas_obj.line(30, height - 90, width - 30, height - 90)

    # Footer
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
    text_width = canvas_obj.stringWidth(page_text, "Helvetica-Bold", 10)
    canvas_obj.drawString(width - 50 - text_width/2, 26, page_text)
    
    canvas_obj.setStrokeColor(SECONDARY_COLOR)
    canvas_obj.setLineWidth(1)
    canvas_obj.line(30, 60, width - 30, 60)
    canvas_obj.restoreState()

# ===============================
# ENHANCED CHARTS
# ===============================
def plot_bar_chart(df, title, columns, ylabel, filename, xlabel="Date"):
    """Enhanced bar chart"""
    plt.style.use('seaborn-v0_8-darkgrid')
    fig, ax = plt.subplots(figsize=(9, 4.5), facecolor='white')
    
    x = np.arange(len(df))
    width = 0.75 / len(columns)
    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']
    
    for i, col in enumerate(columns):
        offset = (i - len(columns)/2 + 0.5) * width
        bars = ax.bar(x + offset, df[col], width, label=col.replace("_", " ").title(),
                     color=colors_list[i % len(colors_list)], edgecolor='white', 
                     linewidth=0.7, alpha=0.9)
        
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.text(bar.get_x() + bar.get_width()/2., height, f'{int(height)}',
                       ha='center', va='bottom', fontsize=7, color='#333333')
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15, color='#003366')
    ax.set_xlabel(xlabel, fontsize=10, fontweight='600', color='#555555')
    ax.set_ylabel(ylabel, fontsize=10, fontweight='600', color='#555555')
    
    step = max(1, len(df) // 12)
    ax.set_xticks([i for i in x if i % step == 0])
    ax.set_xticklabels([df.iloc[i]['date'].strftime("%d %b") for i in x if i % step == 0], 
                       rotation=45, ha='right', fontsize=8)
    
    ax.legend(fontsize=8, loc='upper left', framealpha=0.95, edgecolor='#CCCCCC')
    ax.grid(axis='y', linestyle='--', alpha=0.3, color='#CCCCCC')
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    plt.tight_layout()
    plt.savefig(filename, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close()

def plot_line_chart(df, title, columns, ylabel, filename):
    """Enhanced line chart"""
    plt.style.use('seaborn-v0_8-darkgrid')
    fig, ax = plt.subplots(figsize=(9, 4.5), facecolor='white')
    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']
    
    for i, col in enumerate(columns):
        color = colors_list[i % len(colors_list)]
        ax.plot(df['date'], df[col], marker='o', linewidth=2.5, markersize=5,
               label=col.replace("_", " ").title(), color=color, alpha=0.9)
        ax.fill_between(df['date'], df[col], alpha=0.15, color=color)
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=15, color='#003366')
    ax.set_xlabel("Date", fontsize=10, fontweight='600', color='#555555')
    ax.set_ylabel(ylabel, fontsize=10, fontweight='600', color='#555555')
    ax.legend(fontsize=9, loc='best', framealpha=0.95, edgecolor='#CCCCCC')
    ax.grid(True, linestyle='--', alpha=0.3, color='#CCCCCC')
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    plt.xticks(rotation=45, ha='right', fontsize=8)
    fig.autofmt_xdate()
    plt.tight_layout()
    plt.savefig(filename, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close()

def plot_pie_chart(labels, values, title, filename):
    """Enhanced pie chart"""
    plt.style.use('seaborn-v0_8-pastel')
    fig, ax = plt.subplots(figsize=(8, 6), facecolor='white')
    colors_list = ['#003366', '#FF6B35', '#4ECDC4', '#FFA726', '#AB47BC']
    explode = [0.05 if v == max(values) else 0 for v in values]
    
    wedges, texts, autotexts = ax.pie(values, labels=labels, autopct='%1.1f%%',
                                       startangle=90, colors=colors_list, explode=explode, 
                                       shadow=True, textprops={'fontsize': 10, 'weight': 'bold'})
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(10)
        autotext.set_weight('bold')
    
    for text in texts:
        text.set_fontsize(10)
        text.set_color('#333333')
    
    ax.set_title(title, fontsize=13, fontweight='bold', pad=20, color='#003366')
    plt.tight_layout()
    plt.savefig(filename, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close()

# ===============================
# INSIGHTS
# ===============================
def generate_insights(df_issues, df_individual, df_users):
    """Generate insights"""
    total_raised = df_issues['total_raised'].sum()
    total_solved = df_issues['total_solved'].sum()
    avg_pending = df_issues['total_pending'].mean()
    resolution_rate = (total_solved / total_raised * 100) if total_raised > 0 else 0
    
    issue_totals = {
        'Safety Compliance': df_issues['safety_compliance_raised'].sum(),
        'Design Conflicts': df_issues['design_conflicts_raised'].sum(),
        'Resource Blockers': df_issues['resource_blockers_raised'].sum(),
        'Workflow Issues': df_issues['workflow_issues_raised'].sum(),
        'Miscellaneous': df_issues['miscellaneous_raised'].sum()
    }
    most_common_issue = max(issue_totals, key=issue_totals.get)
    
    resolved_issues = df_individual[df_individual['resolved_status'] == 'Resolved']
    avg_resolution_time = resolved_issues['Solving_time'].mean() if len(resolved_issues) > 0 else 0
    
    total_logins = df_users['login_count'].sum()
    avg_time_spent = df_users['time_spent'].mean()
    most_active_user = df_users.groupby('username')['time_spent'].sum().idxmax()
    
    return {
        'overview': f"During <b>{current_month} {current_year}</b>, <b>{total_raised}</b> issues were raised with <b>{total_solved}</b> resolved ({resolution_rate:.1f}% resolution rate). Average pending: <b>{avg_pending:.1f}</b>.",
        'issue_breakdown': f"<b>{most_common_issue}</b> was most frequent with <b>{issue_totals[most_common_issue]}</b> incidents. Safety: <b>{issue_totals['Safety Compliance']}</b>, Design+Resource: <b>{issue_totals['Design Conflicts'] + issue_totals['Resource Blockers']}</b>.",
        'resolution': f"Average resolution time: <b>{avg_resolution_time:.1f} hours</b> ({avg_resolution_time/24:.1f} days). <b>{(resolved_issues['Solving_time'] < 72).sum()}</b> issues resolved within 3 days.",
        'engagement': f"<b>{total_logins}</b> logins, <b>{avg_time_spent:.0f} min</b> avg session. Most active: <b>{most_active_user.replace('_', ' ')}</b>.",
        'recommendations': "<b>Recommendations:</b> (1) Bi-weekly safety audits (2) Weekly BIM meetings (3) 15% resource buffer (4) Mobile reporting tools (5) Monthly training",
        'kpis': {'total_raised': total_raised, 'total_solved': total_solved, 'resolution_rate': resolution_rate,
                 'avg_pending': avg_pending, 'avg_resolution_hours': avg_resolution_time,
                 'total_logins': total_logins, 'avg_session_minutes': avg_time_spent}
    }

# ===============================
# PDF BUILDER
# ===============================
def build_pdf(df_issues, df_individual, df_users):
    """Build enhanced PDF"""
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("CustomTitle", parent=styles["Heading1"], fontSize=20,
        textColor=PRIMARY_COLOR, alignment=TA_CENTER, spaceAfter=10, fontName="Helvetica-Bold", leading=24)
    
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=11,
        textColor=colors.HexColor("#666666"), alignment=TA_CENTER, spaceAfter=25, fontName="Helvetica", leading=14)
    
    section_title = ParagraphStyle("SectionTitle", parent=styles["Heading2"], fontSize=14,
        textColor=PRIMARY_COLOR, spaceBefore=20, spaceAfter=12, fontName="Helvetica-Bold", leading=18)
    
    subsection_title = ParagraphStyle("SubsectionTitle", parent=styles["Heading3"], fontSize=12,
        textColor=SECONDARY_COLOR, spaceBefore=12, spaceAfter=8, fontName="Helvetica-Bold", leftIndent=10, leading=15)
    
    body_style = ParagraphStyle("CustomBody", parent=styles["BodyText"], fontSize=10, leading=16,
        alignment=TA_JUSTIFY, textColor=colors.HexColor("#333333"), spaceBefore=6, spaceAfter=6, leftIndent=10, rightIndent=10)

    insights = generate_insights(df_issues, df_individual, df_users)

    # Cover Page
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("CONSTRUCTION SITE<br/>MONTHLY OPERATIONS REPORT", title_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(f"<b>Period:</b> {current_month} {current_year}<br/><b>Project:</b> Downtown Construction<br/><b>Site:</b> SITE-001<br/><b>Generated:</b> {today.strftime('%B %d, %Y')}", subtitle_style))
    story.append(Spacer(1, 0.5*inch))
    
    # KPI Table
    kpis = insights['kpis']
    kpi_data = [
        ['KEY PERFORMANCE INDICATORS', ''],
        ['Total Issues Raised', f"{kpis['total_raised']}"],
        ['Total Issues Resolved', f"{kpis['total_solved']}"],
        ['Resolution Rate', f"{kpis['resolution_rate']:.1f}%"],
        ['Avg Resolution Time', f"{kpis['avg_resolution_hours']:.1f} hrs"],
        ['Platform Logins', f"{kpis['total_logins']}"],
    ]
    
    kpi_table = Table(kpi_data, colWidths=[3.5*inch, 2*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
        ('TOPPADDING', (0, 0), (-1, 0), 15),
        ('GRID', (0, 0), (-1, -1), 1.5, MEDIUM_GRAY),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
    ]))
    
    story.append(kpi_table)
    story.append(PageBreak())

    # Executive Summary
    story.append(Paragraph("EXECUTIVE SUMMARY", section_title))
    story.append(Paragraph(insights['overview'], body_style))
    story.append(Spacer(1, 0.3*inch))

    # Section 1: Issues Raised
    story.append(Paragraph("1. ISSUES ANALYSIS", section_title))
    story.append(Paragraph("1.1 Issues Raised by Category", subsection_title))
    
    issue_cols = ['safety_compliance_raised', 'design_conflicts_raised', 'resource_blockers_raised', 
                  'workflow_issues_raised', 'miscellaneous_raised']
    plot_bar_chart(df_issues, "Daily Issues Raised by Category", issue_cols, "Count", "g1.png")
    story.append(Image("g1.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(insights['issue_breakdown'], body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 2: Raised vs Solved
    story.append(Paragraph("1.2 Issues Raised vs Resolved", subsection_title))
    plot_line_chart(df_issues, "Daily Trend: Raised vs Resolved", ['total_raised', 'total_solved'], "Count", "g2.png")
    story.append(Image("g2.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(f"Consistent management throughout {current_month}. Peak: <b>{df_issues['total_raised'].max()}</b> issues.", body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 3: Pending Trend
    story.append(Paragraph("1.3 Pending Issues Trend", subsection_title))
    plot_line_chart(df_issues, "Pending Issues Over Time", ['total_pending'], "Pending Count", "g3.png")
    story.append(Image("g3.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(f"Average pending: <b>{df_issues['total_pending'].mean():.1f}</b>, Peak: <b>{df_issues['total_pending'].max()}</b>, Low: <b>{df_issues['total_pending'].min()}</b>.", body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 4: Distribution
    story.append(Paragraph("1.4 Issue Distribution", subsection_title))
    issue_totals = [df_issues[col].sum() for col in issue_cols]
    issue_labels = ['Safety', 'Design', 'Resource', 'Workflow', 'Misc']
    plot_pie_chart(issue_labels, issue_totals, "Issue Type Distribution", "g4.png")
    story.append(Image("g4.png", width=4.5*inch, height=3.4*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("Proportional distribution helps prioritize resource allocation.", body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 5: Resolution Performance
    story.append(Paragraph("2. RESOLUTION PERFORMANCE", section_title))
    solved_cols = ['safety_compliance_solved', 'design_conflicts_solved', 'resource_blockers_solved',
                   'workflow_issues_solved', 'miscellaneous_solved']
    plot_bar_chart(df_issues, "Issues Solved by Category", solved_cols, "Count", "g5.png")
    story.append(Image("g5.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(insights['resolution'], body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 6: User Engagement
    story.append(Paragraph("3. USER ENGAGEMENT", section_title))
    user_daily = df_users.groupby('date').agg({'login_count': 'sum', 'time_spent': 'sum'}).reset_index()
    plot_line_chart(user_daily, "Daily User Logins", ['login_count'], "Logins", "g6.png")
    story.append(Image("g6.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(insights['engagement'], body_style))
    story.append(Spacer(1, 0.25*inch))

    # Section 7: Time Spent
    story.append(Paragraph("3.1 Platform Usage Time", subsection_title))
    plot_line_chart(user_daily, "Daily Time Spent", ['time_spent'], "Minutes", "g7.png")
    story.append(Image("g7.png", width=5.5*inch, height=2.75*inch))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(f"Total: <b>{df_users['time_spent'].sum():.0f} min</b> ({df_users['time_spent'].sum()/60:.1f} hrs). Peak usage mid-month.", body_style))
    story.append(Spacer(1, 0.25*inch))

    # Recommendations
    story.append(Paragraph("4. RECOMMENDATIONS", section_title))
    story.append(Paragraph(insights['recommendations'], body_style))
    story.append(Spacer(1, 0.25*inch))

    # Summary Table
    story.append(Paragraph("5. MONTHLY STATISTICS", section_title))
    summary_data = [
        ['Metric', 'Value'],
        ['Total Issues Raised', str(df_issues['total_raised'].sum())],
        ['Total Issues Solved', str(df_issues['total_solved'].sum())],
        ['Average Pending', f"{df_issues['total_pending'].mean():.1f}"],
        ['Resolution Rate', f"{kpis['resolution_rate']:.1f}%"],
        ['Avg Resolution Time', f"{kpis['avg_resolution_hours']:.1f} hrs"],
        ['Total Logins', str(kpis['total_logins'])],
        ['Total Platform Time', f"{df_users['time_spent'].sum()/60:.1f} hrs"],
    ]
    
    summary_table = Table(summary_data, colWidths=[3.5*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
    ]))
    
    story.append(summary_table)
    return story

# ===============================
# MAIN
# ===============================
def generate_pdf_report():
    """Generate enhanced report"""
    print("🔄 Generating demo data...")
    df_issues, df_individual, df_users = generate_construction_demo_data()
    
    print("📊 Creating visualizations...")
    story = build_pdf(df_issues, df_individual, df_users)
    
    print("📄 Building PDF...")
    doc = SimpleDocTemplate(OUTPUT_FILE, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=100, bottomMargin=80)
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    
    print(f"✅ Enhanced report generated: {OUTPUT_FILE}")
    print(f"📈 Data: {len(df_issues)} days, {len(df_individual)} issues, {len(df_users)} user records")
    print(f"📊 7 professional visualizations with enhanced styling")

if __name__ == "__main__":
    generate_pdf_report()
