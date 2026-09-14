import httpx
import re
import html
from datetime import datetime
import xml.etree.ElementTree as ET


def fetch_appstore_reviews(business, db, analyze_sentiment, Mention, send_negative_alert):
    if not getattr(business, 'appstore_id', None):
        return 0
    count = 0
    try:
        url = f"https://itunes.apple.com/rss/customerreviews/id={business.appstore_id}/sortBy=mostRecent/xml"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        if res.status_code != 200:
            print(f"App Store returned {res.status_code}")
            return 0
        root = ET.fromstring(res.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns)
        print(f"App Store: {len(entries)} reviews found")
        for entry in entries:
            try:
                title = entry.find("atom:title", ns)
                content = entry.find("atom:content", ns)
                id_el = entry.find("atom:id", ns)
                author = entry.find("atom:author/atom:name", ns)
                rating_el = entry.find("{http://itunes.apple.com/rss}rating")
                title_text = title.text if title is not None else ""
                content_text = content.text if content is not None else ""
                full_text = f"{title_text} {content_text}".strip()[:2000]
                url_val = id_el.text if id_el is not None else ""
                author_name = author.text if author is not None else "appstore_user"
                rating = int(rating_el.text) if rating_el is not None else None
                if not url_val:
                    continue
                existing = db.query(Mention).filter(Mention.business_id == business.id, Mention.url == url_val).first()
                if existing:
                    continue
                analysis = analyze_sentiment(full_text)
                if analysis.get("is_spam", False):
                    print(f"Skipping spam mention")
                    continue
                mention = Mention(
                    business_id=business.id, source="App Store",
                    content=full_text, url=url_val, author=author_name,
                    language=analysis.get("language", "en"),
                    sentiment=analysis.get("sentiment", "neutral"),
                    sentiment_score=analysis.get("score", 0.5),
                    sentiment_reason=analysis.get("reason", ""),
                    suggested_reply=analysis.get("suggested_reply", ""),
                    topic=analysis.get("topic", "General"),
                    is_spam=analysis.get("is_spam", False),
                    star_rating=rating, fetched_at=datetime.utcnow()
                )
                db.add(mention)
                db.commit()
                db.refresh(mention)
                if mention.sentiment == "negative" and business.alert_on_negative:
                    send_negative_alert(business, mention)
                count += 1
            except Exception as e:
                db.rollback()
                print(f"App Store entry error: {e}")
    except Exception as e:
        print(f"App Store fetch error: {e}")
    return count


def fetch_playstore_reviews(business, db, analyze_sentiment, Mention, send_negative_alert):
    if not getattr(business, 'playstore_id', None):
        return 0
    count = 0
    try:
        from google_play_scraper import reviews, Sort
        result, _ = reviews(
            business.playstore_id,
            lang='en',
            country='ca',
            sort=Sort.NEWEST,
            count=20
        )
        print(f"Play Store: {len(result)} reviews found for {business.playstore_id}")
        for r in result:
            try:
                review_text = r.get('content', '').strip()
                if not review_text or len(review_text) < 10:
                    continue
                url_val = f"https://play.google.com/store/apps/details?id={business.playstore_id}#review-{r.get('reviewId', hash(review_text))}"
                existing = db.query(Mention).filter(Mention.business_id == business.id, Mention.url == url_val).first()
                if existing:
                    continue
                analysis = analyze_sentiment(review_text)
                if analysis.get("is_spam", False):
                    print(f"Skipping spam mention")
                    continue
                mention = Mention(
                    business_id=business.id, source="Play Store",
                    content=review_text, url=url_val,
                    author=r.get('userName', 'playstore_user'),
                    language=analysis.get("language", "en"),
                    sentiment=analysis.get("sentiment", "neutral"),
                    sentiment_score=analysis.get("score", 0.5),
                    sentiment_reason=analysis.get("reason", ""),
                    suggested_reply=analysis.get("suggested_reply", ""),
                    topic=analysis.get("topic", "General"),
                    is_spam=analysis.get("is_spam", False),
                    star_rating=r.get('score'),
                    posted_at=r.get('at'),
                    fetched_at=datetime.utcnow()
                )
                db.add(mention)
                db.commit()
                db.refresh(mention)
                if mention.sentiment == "negative" and business.alert_on_negative:
                    send_negative_alert(business, mention)
                count += 1
            except Exception as e:
                db.rollback()
                print(f"Play Store entry error: {e}")
    except Exception as e:
        print(f"Play Store fetch error: {e}")
    return count


def fetch_trustpilot_reviews(business, db, analyze_sentiment, Mention, send_negative_alert):
    if not getattr(business, 'trustpilot_domain', None):
        return 0
    count = 0
    try:
        url = f"https://www.trustpilot.com/review/{business.trustpilot_domain}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        res = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
        if res.status_code != 200:
            print(f"Trustpilot returned {res.status_code}")
            return 0
        matches = re.findall(r'"text"\s*:\s*"([^"]{20,1000})"', res.text)
        rating_matches = re.findall(r'"stars"\s*:\s*(\d)', res.text)
        author_matches = re.findall(r'"displayName"\s*:\s*"([^"]+)"', res.text)
        print(f"Trustpilot: Found {len(matches)} reviews for {business.trustpilot_domain}")
        for i, review_text in enumerate(matches[:20]):
            try:
                clean_text = html.unescape(review_text).strip()
                if len(clean_text) < 20:
                    continue
                rating = int(rating_matches[i]) if i < len(rating_matches) else None
                author = author_matches[i] if i < len(author_matches) else "trustpilot_user"
                url_val = f"{url}#review-{i}-{hash(clean_text)}"
                existing = db.query(Mention).filter(Mention.business_id == business.id, Mention.url == url_val).first()
                if existing:
                    continue
                analysis = analyze_sentiment(clean_text)
                if analysis.get("is_spam", False):
                    print(f"Skipping spam mention")
                    continue
                mention = Mention(
                    business_id=business.id, source="Trustpilot",
                    content=clean_text, url=url_val, author=author,
                    language=analysis.get("language", "en"),
                    sentiment=analysis.get("sentiment", "neutral"),
                    sentiment_score=analysis.get("score", 0.5),
                    sentiment_reason=analysis.get("reason", ""),
                    suggested_reply=analysis.get("suggested_reply", ""),
                    topic=analysis.get("topic", "General"),
                    is_spam=analysis.get("is_spam", False),
                    star_rating=rating, fetched_at=datetime.utcnow()
                )
                db.add(mention)
                db.commit()
                db.refresh(mention)
                if mention.sentiment == "negative" and business.alert_on_negative:
                    send_negative_alert(business, mention)
                count += 1
            except Exception as e:
                db.rollback()
                print(f"Trustpilot entry error: {e}")
    except Exception as e:
        print(f"Trustpilot fetch error: {e}")
    return count
