import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

def _parse_date(date_str):
    if not date_str:
        return None
    try:
        from dateutil import parser as dp
        return dp.parse(date_str).replace(tzinfo=None)
    except:
        try:
            import re
            now = datetime.utcnow()
            m = re.search(r'(\d+)\s+(day|week|month|year)', date_str.lower())
            if m:
                n, unit = int(m.group(1)), m.group(2)
                if unit == 'day': return now - timedelta(days=n)
                if unit == 'week': return now - timedelta(weeks=n)
                if unit == 'month': return now - timedelta(days=n*30)
                if unit == 'year': return now - timedelta(days=n*365)
        except:
            pass
    return None

def fetch_google_reviews(business, db, analyze_sentiment, Mention, send_negative_alert):
    try:
        if not SERPAPI_KEY or SERPAPI_KEY == "your_serpapi_key":
            print("No SerpApi key")
            return 0
        from serpapi import GoogleSearch
        # Use stored google_place_id if available, otherwise skip
        place_id = getattr(business, 'google_place_id', None)
        if not place_id:
            # Try to find from DB cache
            from sqlalchemy import text as sqlt
            row = db.execute(sqlt("SELECT url FROM mentions WHERE business_id=:bid AND source='Google Reviews' LIMIT 1"), {"bid": business.id}).fetchone()
            if row and row[0] and 'place_id:' in row[0]:
                place_id = row[0].split('place_id:')[1].split('&')[0]
            elif row and row[0] and 'place_id=' in row[0]:
                place_id = row[0].split('place_id=')[1].split('&')[0]
        if not place_id:
            print(f"No place_id available for {business.name} - skipping Google Reviews")
            return 0
        place_name = business.name
        print(f"Using place_id: {place_id} for {business.name}")
        print(f"Found: {place_name} (place_id: {place_id})")
        # Fetch multiple pages of reviews (up to 5 pages = ~40 reviews)
        all_reviews = []
        next_token = ""
        for page in range(5):
            params = {
                "engine": "google_maps_reviews",
                "place_id": place_id,
                "api_key": SERPAPI_KEY,
                "hl": "en",
                "sort_by": "2"
            }
            if next_token:
                params["next_page_token"] = next_token
            search2 = GoogleSearch(params)
            results2 = search2.get_dict()
            page_reviews = results2.get("reviews", [])
            if not page_reviews:
                break
            all_reviews.extend(page_reviews)
            next_token = results2.get("serpapi_pagination", {}).get("next_page_token", "")
            print(f"Page {page+1}: {len(page_reviews)} reviews fetched")
            if not next_token:
                break
        reviews = all_reviews
        print(f"Fetched {len(reviews)} Google reviews total")
        count = 0
        for review in reviews:
            author = review.get("user", {}).get("name", "anonymous")
            rating = review.get("rating", 3)
            text = review.get("snippet", "").strip()
            review_id = review.get("review_id", f"{author}_{rating}")
            url_val = f"https://www.google.com/maps/place/?q=place_id:{place_id}&rid={review_id}"
            if not text:
                continue
            existing = db.query(Mention).filter(
                Mention.business_id == business.id,
                Mention.url == url_val
            ).first()
            if existing:
                continue
            print(f"Analyzing: {author} ({rating} stars) - {text[:60]}...")
            analysis = analyze_sentiment(f"Rating: {rating}/5 stars. Review: {text}")
            real_date = _parse_date(review.get('iso_date') or review.get('date'))
            mention = Mention(
                business_id=business.id,
                source="Google Reviews",
                content=f"Rating: {rating}/5 stars\n\n{text}",
                url=url_val,
                author=author,
                language=analysis.get("language", "en"),
                sentiment=analysis.get("sentiment", "neutral"),
                sentiment_score=analysis.get("score", 0.5),
                sentiment_reason=analysis.get("reason", ""),
                suggested_reply=analysis.get("suggested_reply", ""),
                topic=analysis.get("topic", "General"),
                is_spam=analysis.get("is_spam", False),
                star_rating=rating,
                posted_at=real_date,
                fetched_at=datetime.utcnow()
            )
            db.add(mention)
            db.commit()
            db.refresh(mention)
            print(f"Saved: {analysis.get('sentiment')} review from {author} (posted: {real_date})")
            if mention.sentiment == "negative" and business.alert_on_negative:
                send_negative_alert(business, mention)
            count += 1
        return count
    except Exception as e:
        print(f"Google Reviews error: {e}")
        return 0
