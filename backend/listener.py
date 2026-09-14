import os
import json
import httpx
import re
import xml.etree.ElementTree as ET
from groq import Groq
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from main import Business, Mention

engine = create_engine(os.getenv("DATABASE_URL"))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

TOPICS = [
    "App Performance", "Food Quality", "Customer Service", "Rewards & Points",
    "Ordering & Delivery", "Pricing & Value", "Store Experience", "New Products",
    "Promotions & Offers", "Complaint", "Compliment", "General"
]

def analyze_sentiment(text: str) -> dict:
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": f"""Analyze this customer mention. Respond in JSON only with no extra text, no markdown, no code blocks. Use exactly these fields:
{{
  "sentiment": "positive" or "negative" or "neutral",
  "score": a number from 0.0 to 1.0 where 1.0 is most positive,
  "reason": "one sentence plain english explanation of why this sentiment",
  "language": "en" for English, "fr" for French, "ur" for Urdu, "pa" for Punjabi, "uk" for Ukrainian, "ar" for Arabic, "hi" for Hindi, "zh" for Chinese, "es" for Spanish, "other" for anything else,
  "suggested_reply": "a warm, human, specific reply the business owner can post. For negative mentions: acknowledge the specific issue mentioned, apologize sincerely, offer to make it right. For positive mentions: thank them warmly and personally. Never use generic phrases like 'we value your feedback'. Be specific to what they actually said. Max 2 sentences.",
  "topic": "one of: App Performance, Food Quality, Customer Service, Rewards & Points, Ordering & Delivery, Pricing & Value, Store Experience, New Products, Promotions & Offers, Complaint, Compliment, General",
  "is_spam": true if this looks like fake/bot/irrelevant content, false otherwise
}}
Mention to analyze: {text[:1000]}"""}],
            max_tokens=400, temperature=0.1
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return {
            "sentiment": result.get("sentiment", "neutral"),
            "score": float(result.get("score", 0.5)),
            "language": result.get("language", "en"),
            "reason": result.get("reason", ""),
            "suggested_reply": result.get("suggested_reply", "Thank you for your feedback."),
            "topic": result.get("topic", "General"),
            "is_spam": bool(result.get("is_spam", False))
        }
    except Exception as e:
        print(f"Sentiment error: {e}")
        return {"sentiment": "neutral", "score": 0.5, "reason": "Could not analyze sentiment", "language": "en", "suggested_reply": "Thank you for your feedback.", "topic": "General", "is_spam": False}

def fetch_reddit_thumbnail(post_url: str) -> str:
    try:
        json_url = post_url.rstrip('/') + '.json'
        headers = {"User-Agent": "Senti/1.0"}
        res = httpx.get(json_url, headers=headers, timeout=10, follow_redirects=True)
        if res.status_code != 200:
            return None
        data = res.json()
        post = data[0]['data']['children'][0]['data']
        preview = post.get('preview', {})
        if preview:
            images = preview.get('images', [])
            if images:
                source = images[0].get('source', {})
                url = source.get('url', '').replace('&amp;', '&')
                if url:
                    return url
        thumbnail = post.get('thumbnail', '')
        if thumbnail and thumbnail.startswith('http'):
            return thumbnail
        return None
    except Exception as e:
        return None

def send_negative_alert(business, mention):
    try:
        import resend
        resend.api_key = os.getenv("RESEND_API_KEY", "")
        if not resend.api_key or resend.api_key == "your_resend_key_here":
            print(f"Alert skipped (no Resend key): negative mention for {business.name}")
            return
        resend.Emails.send({
            "from": "Senti Alerts <onboarding@resend.dev>",
            "to": [business.alert_email],
            "subject": f"Senti Alert: Negative mention for {business.name}",
            "html": f"""
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <div style="background:#0D1B2A;border-radius:10px;padding:20px 24px;margin-bottom:20px">
                <div style="font-size:18px;font-weight:500;color:#fff">Senti</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4)">Community intelligence</div>
              </div>
              <h2 style="color:#DC2626;font-size:18px">Negative mention detected</h2>
              <p style="color:#5A6B7B;font-size:13px">A negative mention was found for <strong>{business.name}</strong>.</p>
              <div style="background:#F4F6F9;border-radius:8px;padding:16px;margin-bottom:16px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:6px">SOURCE: {mention.source}</div>
                <div style="font-size:13px;color:#2D3748;line-height:1.6">{mention.content[:400]}</div>
              </div>
              <div style="background:#FEF2F2;border-left:3px solid #DC2626;padding:12px 16px;margin-bottom:16px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:4px">WHY NEGATIVE</div>
                <div style="font-size:13px;color:#DC2626">{mention.sentiment_reason}</div>
              </div>
              <div style="background:#E6FBF5;border-left:3px solid #00C6A2;padding:12px 16px;margin-bottom:20px">
                <div style="font-size:11px;color:#8F9DB0;margin-bottom:4px">SUGGESTED REPLY</div>
                <div style="font-size:13px;color:#00875A">{mention.suggested_reply}</div>
              </div>
              <a href="http://138.199.159.32" style="background:#0D1B2A;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">View in Senti dashboard</a>
            </div>
            """
        })
        print(f"Alert sent to {business.alert_email}")
    except Exception as e:
        print(f"Alert error: {e}")

def fetch_reddit_rss(business, db):
    try:
        keywords = [k.strip() for k in business.keywords.split(",") if k.strip()]
        keywords.insert(0, business.name)
        count = 0
        headers = {"User-Agent": "Senti/1.0 social listening tool"}
        for keyword in keywords[:3]:
            try:
                encoded = keyword.replace(" ", "+")
                url = f"https://www.reddit.com/search.rss?q={encoded}&sort=new&limit=10"
                response = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
                if response.status_code != 200:
                    continue
                root = ET.fromstring(response.text)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                entries = root.findall("atom:entry", ns)
                print(f"Found {len(entries)} RSS entries for: {keyword}")
                for entry in entries:
                    title = entry.find("atom:title", ns)
                    link = entry.find("atom:link", ns)
                    content = entry.find("atom:content", ns)
                    author = entry.find("atom:author/atom:name", ns)
                    published = entry.find("atom:published", ns)
                    url_val = link.get("href") if link is not None else ""
                    title_text = title.text if title is not None else ""
                    content_text = content.text if content is not None else ""
                    author_name = author.text if author is not None else "reddit_user"
                    if author_name and "/" in author_name:
                        author_name = author_name.split("/")[-1]
                    post_date = datetime.utcnow()
                    if published is not None and published.text:
                        try:
                            from dateutil import parser as dp
                            post_date = dp.parse(published.text).replace(tzinfo=None)
                        except:
                            pass
                    full_text = re.sub(r"<[^>]+>", " ", f"{title_text} {content_text}").strip()
                    import html as _html
                    full_text = _html.unescape(full_text)
                    full_text = re.sub(r"\s+", " ", full_text).strip()[:2000]
                    if not url_val:
                        continue
                    # Strict filter: keyword must appear in title OR multiple times in content
                    full_text_lower = full_text.lower()
                    title_lower = title_text.lower()
                    all_keywords = [business.name.lower()] + [k.strip().lower() for k in business.keywords.split(",") if k.strip()]
                    in_title = any(kw in title_lower for kw in all_keywords)
                    in_content_twice = any(full_text_lower.count(kw) >= 2 for kw in all_keywords)
                    if not in_title and not in_content_twice:
                        print(f"Skipping irrelevant post: {title_text[:60]}")
                        continue
                    existing = db.query(Mention).filter(Mention.business_id == business.id, Mention.url == url_val).first()
                    if existing:
                        continue
                    print(f"Analyzing: {title_text[:60]}...")
                    analysis = analyze_sentiment(full_text)
                    if analysis.get("is_spam", False):
                        print(f"Skipping spam mention")
                        continue
                    image_url = fetch_reddit_thumbnail(url_val)
                    mention = Mention(
                        business_id=business.id,
                        source="Reddit",
                        content=full_text,
                        url=url_val,
                        author=author_name,
                        language=analysis.get("language", "en"),
                        sentiment=analysis.get("sentiment", "neutral"),
                        sentiment_score=analysis.get("score", 0.5),
                        sentiment_reason=analysis.get("reason", ""),
                        suggested_reply=analysis.get("suggested_reply", ""),
                        topic=analysis.get("topic", "General"),
                        is_spam=analysis.get("is_spam", False),
                        image_url=image_url,
                        posted_at=post_date,
                        fetched_at=datetime.utcnow()
                    )
                    db.add(mention)
                    db.commit()
                    db.refresh(mention)
                    print(f"Saved: {analysis.get('sentiment')} mention {'with image' if image_url else ''}")
                    if mention.sentiment == "negative" and business.alert_on_negative:
                        send_negative_alert(business, mention)
                    count += 1
            except Exception as e:
                db.rollback()
                print(f"RSS error for {keyword}: {e}")
        return count
    except Exception as e:
        print(f"Reddit fetch error: {e}")
        return 0


def run_ai_agent(business, db):
    import httpx, os
    from datetime import datetime, timedelta
    try:
        from sqlalchemy import text as sqlt
        # Get agent settings
        result = db.execute(sqlt("SELECT enabled, auto_resolve, auto_escalate, auto_draft, escalate_threshold FROM agent_settings WHERE business_id=:bid"), {"bid": business.id}).fetchone()
        if not result or not result[0]:
            return
        enabled, auto_resolve, auto_escalate, auto_draft, escalate_threshold = result

        # Get unprocessed mentions (last 2 hours, not resolved, not spam)
        two_hours_ago = datetime.utcnow() - timedelta(hours=2)
        mentions = db.query(Mention).filter(
            Mention.business_id == business.id,
            Mention.is_resolved == False,
            Mention.is_spam == False,
            Mention.fetched_at >= two_hours_ago
        ).all()

        # Check which mentions already have agent actions
        processed_ids = set(row[0] for row in db.execute(sqlt("SELECT mention_id FROM agent_actions WHERE business_id=:bid AND created_at>=:since"), {"bid": business.id, "since": two_hours_ago}).fetchall())

        groq_key = os.getenv("GROQ_API_KEY", "")
        resend_key = os.getenv("RESEND_API_KEY", "")
        resolve_count = escalate_count = draft_count = 0

        for mention in mentions:
            if mention.id in processed_ids:
                continue

            # AUTO-RESOLVE: resolve positive mentions
            if auto_resolve and mention.sentiment == "positive":
                db.execute(sqlt("UPDATE mentions SET is_resolved=true WHERE id=:id"), {"id": mention.id})
                db.execute(sqlt("INSERT INTO agent_actions (business_id, mention_id, action_type, detail) VALUES (:bid, :mid, :atype, :detail)"),
                    {"bid": business.id, "mid": mention.id, "atype": "auto_resolved", "detail": f"Auto-resolved positive mention from {mention.source}"})
                resolve_count += 1

            # AUTO-ESCALATE: flag and email negative mentions below threshold
            if auto_escalate and mention.sentiment == "negative" and (mention.sentiment_score or 0.5) <= escalate_threshold:
                # Add escalated tag
                existing_tags = mention.tags or ""
                if "escalated" not in existing_tags:
                    new_tags = (existing_tags + ",escalated").strip(",")
                    db.execute(sqlt("UPDATE mentions SET tags=:tags WHERE id=:id"), {"tags": new_tags, "id": mention.id})
                # Send escalation email
                if business.alert_email and resend_key:
                    try:
                        httpx.post(
                            "https://api.resend.com/emails",
                            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                            json={
                                "from": "Senti Agent <onboarding@resend.dev>",
                                "to": [business.alert_email],
                                "subject": f"🤖 Agent Escalation: Urgent mention for {business.name}",
                                "html": f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                                <div style="background:#7C3AED;padding:20px;border-radius:8px 8px 0 0">
                                    <h2 style="color:white;margin:0">🤖 AI Agent Escalation</h2>
                                    <p style="color:#DDD6FE;margin:5px 0 0">{business.name}</p>
                                </div>
                                <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
                                    <p style="font-size:15px;color:#111">A high-priority negative mention needs your attention:</p>
                                    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:15px;margin:15px 0">
                                        <p style="font-weight:600;color:#DC2626;margin:0 0 5px">[{mention.source}] - Score: {round((mention.sentiment_score or 0.5)*100)}/100</p>
                                        <p style="color:#374151;margin:0">{mention.content[:300]}</p>
                                    </div>
                                    <a href="https://senti-community.vercel.app" style="background:#7C3AED;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review in Senti</a>
                                </div>
                                </div>"""
                            }, timeout=10
                        )
                    except Exception as e:
                        print(f"Escalation email error: {e}")
                db.execute(sqlt("INSERT INTO agent_actions (business_id, mention_id, action_type, detail) VALUES (:bid, :mid, :atype, :detail)"),
                    {"bid": business.id, "mid": mention.id, "atype": "auto_escalated", "detail": f"Escalated urgent negative mention from {mention.source} (score: {round((mention.sentiment_score or 0.5)*100)})"})
                escalate_count += 1

            # AUTO-DRAFT: generate reply draft for negative mentions
            if auto_draft and mention.sentiment == "negative" and not mention.suggested_reply:
                try:
                    res = httpx.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                        json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": f"You are a customer service agent for {business.name}. Write a professional, empathetic reply to this customer review. Be specific to their complaint. Keep it under 100 words. Do not use placeholders.\n\nReview: {mention.content[:400]}"}], "max_tokens": 150, "temperature": 0.4},
                        timeout=20
                    )
                    draft = res.json()["choices"][0]["message"]["content"].strip()
                    db.execute(sqlt("UPDATE mentions SET suggested_reply=:reply WHERE id=:id"), {"reply": draft, "id": mention.id})
                    db.execute(sqlt("INSERT INTO agent_actions (business_id, mention_id, action_type, detail) VALUES (:bid, :mid, :atype, :detail)"),
                        {"bid": business.id, "mid": mention.id, "atype": "auto_drafted", "detail": f"Auto-drafted reply for {mention.source} mention"})
                    draft_count += 1
                except Exception as e:
                    print(f"Auto-draft error: {e}")

        db.commit()
        if resolve_count or escalate_count or draft_count:
            print(f"AI Agent [{business.name}]: resolved={resolve_count} escalated={escalate_count} drafted={draft_count}")

    except Exception as e:
        print(f"AI Agent error for {business.name}: {e}")
        db.rollback()

def run_listener_with_google():
    db = SessionLocal()
    try:
        from google_reviews import fetch_google_reviews
        from review_sources import fetch_appstore_reviews, fetch_playstore_reviews, fetch_trustpilot_reviews
        businesses = db.query(Business).all()
        print(f"Listener running for {len(businesses)} businesses at {datetime.utcnow()}")
        for business in businesses:
            print(f"Processing: {business.name}")
            reddit_count = fetch_reddit_rss(business, db) if getattr(business, 'reddit_enabled', True) else 0
            print(f"Reddit: {reddit_count} new mentions")
            google_count = fetch_google_reviews(business, db, analyze_sentiment, Mention, send_negative_alert) if getattr(business, 'google_enabled', True) else 0
            print(f"Google: {google_count} new mentions")
            appstore_count = fetch_appstore_reviews(business, db, analyze_sentiment, Mention, send_negative_alert)
            print(f"App Store: {appstore_count} new mentions")
            playstore_count = fetch_playstore_reviews(business, db, analyze_sentiment, Mention, send_negative_alert)
            print(f"Play Store: {playstore_count} new mentions")
            trustpilot_count = fetch_trustpilot_reviews(business, db, analyze_sentiment, Mention, send_negative_alert)
            print(f"Trustpilot: {trustpilot_count} new mentions")
            run_ai_agent(business, db)
    except Exception as e:
        print(f"Listener error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_listener_with_google()
