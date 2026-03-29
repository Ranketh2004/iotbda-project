import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)


def send_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password reset email via SMTP. Returns True on success."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg["Subject"] = "Reset your Infant Cry Guard password"

    text = (
        f"Hello,\n\n"
        f"You requested a password reset for your Infant Cry Guard account.\n\n"
        f"Click the link below to reset your password:\n"
        f"{reset_link}\n\n"
        f"This link expires in 15 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— Infant Cry Guard Team"
    )

    html = f"""\
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #be185d;">Infant Cry Guard</h2>
      <p>Hello,</p>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="{reset_link}"
           style="background: linear-gradient(135deg, #ec4899, #f472b6);
                  color: #fff; text-decoration: none; padding: 12px 32px;
                  border-radius: 8px; font-weight: 600; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 0.85rem; color: #666;">
        This link expires in 15 minutes. If you didn't request this, ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 0.8rem; color: #999;">— Infant Cry Guard Team</p>
    </div>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Reset email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send reset email to %s: %s", to_email, e)
        return False
