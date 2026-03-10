import smtplib
from email.message import EmailMessage
import os
from config import settings

SMTP_SERVER = settings.SMTP_SERVER
SMTP_PORT = settings.SMTP_PORT
SMTP_USER = settings.SMTP_USER
SMTP_PASS = settings.SMTP_PASS
FROM_EMAIL = settings.FROM_EMAIL

def send_critical_anomaly_email(to_email: str, anomaly: dict):
    """
    Send a beautifully formatted HTML email report for a critical anomaly.
    """
    if not to_email:
        return

    msg = EmailMessage()
    msg['Subject'] = f"🚨 CRITICAL ALERT: {anomaly.get('category')} in {anomaly.get('namespace')}"
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email

    from string import Template
    
    # Load the external HTML template
    template_path = os.path.join("templates", "alert_email.html")
    with open(template_path, "r", encoding="utf-8") as f:
        template_str = f.read()

    # Safely substitute the variables into the HTML string
    html_content = Template(template_str).safe_substitute(
        severity=anomaly.get("severity", "CRITICAL").upper(),
        category=anomaly.get("category", "Unknown"),
        namespace=anomaly.get("namespace", "default"),
        resource_name=anomaly.get("resource_name", "Unknown"),
        resource_type=anomaly.get("resource_type", "Unknown"),
        message=anomaly.get("message", "No message provided."),
        timestamp=anomaly.get("timestamp", "Unknown time"),
        details=anomaly.get("details", ""),
        logs=anomaly.get("logs", "")[:2000]
    )

    msg.set_content("Critical Anomaly Detected: " + anomaly.get("message", ""))
    msg.add_alternative(html_content, subtype='html')

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            # Most modern external mail servers require TLS, especially if we are logging in.
            if SMTP_PORT == 587 or SMTP_USER:
                try:
                    server.starttls()
                    server.ehlo()
                except smtplib.SMTPNotSupportedError:
                    pass # Ignore if server (like Mailhog) doesn't support TLS
                    
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            
            server.send_message(msg)
        print(f"📧 Alert email successfully sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send alert email to {to_email}: {e}")
