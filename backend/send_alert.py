import os
import resend
from dotenv import load_dotenv
load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

def send_negative_alert(business, mention):
    try:
        resend.Emails.send({
            "from": "Senti Alerts <onboarding@resend.dev>",
            "to": [business.alert_email],
            "subject": f"Senti Alert: Negative mention detected for {business.name}",
            "html": f"""
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <div style="background:#0D1B2A;border-radius:10px;padding:20px 24px;margin-bottom:20px">
                <div style="font-size:18px;font-weight:500;color:#fff;margin-bottom:4px">Senti</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4)">Community intelligence</div>
              </div>
              <h2 style="color:#DC2626;font-size:18px;margin-bottom:6px">Negative mention detected</h2>
              <p style="color:#5A6B7B;font-size:13px;margin-bottom:20px">A negative mention was found for <strong>{business.name}</strong>. Respond quickly before it spreads.</p>
              <div style="background:#F4F6F9;border-radius:8px;padding:16px;margin-bottom:16px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:6px">SOURCE: {mention.source}</div>
                <div style="font-size:13px;color:#2D3748;line-height:1.6">{mention.content[:400]}</div>
              </div>
              <div style="background:#FEF2F2;border-left:3px solid #DC2626;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:4px">WHY NEGATIVE</div>
                <div style="font-size:13px;color:#DC2626">{mention.sentiment_reason}</div>
              </div>
              <div style="background:#E6FBF5;border-left:3px solid #00C6A2;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:4px">SUGGESTED REPLY</div>
                <div style="font-size:13px;color:#00875A">{mention.suggested_reply}</div>
              </div>
              <a href="http://138.199.159.32" style="display:inline-block;background:#0D1B2A;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">View in Senti dashboard</a>
            </div>
            """
        })
        print(f"Alert sent to {business.alert_email}")
    except Exception as e:
        print(f"Alert error: {e}")
