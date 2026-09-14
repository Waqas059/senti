from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

app = FastAPI(title="Senti API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    businesses = relationship("Business", back_populates="owner")

class Business(Base):
    __tablename__ = "businesses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    keywords = Column(Text, default="")
    alert_email = Column(String)
    alert_on_negative = Column(Boolean, default=True)
    daily_digest = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reddit_enabled = Column(Boolean, default=True)
    google_enabled = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    appstore_id = Column(String, nullable=True)
    playstore_id = Column(String, nullable=True)
    trustpilot_domain = Column(String, nullable=True)
    playstore_enabled = Column(Boolean, default=True)
    appstore_enabled = Column(Boolean, default=True)
    trustpilot_enabled = Column(Boolean, default=True)
    google_place_id = Column(String, nullable=True)
    owner = relationship("User", back_populates="businesses")
    mentions = relationship("Mention", back_populates="business")

class Mention(Base):
    __tablename__ = "mentions"
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    source = Column(String)
    content = Column(Text)
    url = Column(String)
    author = Column(String)
    language = Column(String, default="en")
    sentiment = Column(String)
    sentiment_score = Column(Float)
    sentiment_reason = Column(Text)
    suggested_reply = Column(Text)
    is_resolved = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)
    subreddit = Column(String, nullable=True)
    star_rating = Column(Integer, nullable=True)
    author_avatar = Column(String, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    topic = Column(String, nullable=True)
    is_spam = Column(Boolean, default=False)
    posted_at = Column(DateTime, nullable=True)
    business = relationship("Business", back_populates="mentions")

Base.metadata.create_all(bind=engine)

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_admin: Optional[bool] = False
    class Config:
        from_attributes = True

class BusinessCreate(BaseModel):
    name: str
    keywords: Optional[str] = ""
    alert_email: Optional[str] = None
    alert_on_negative: Optional[bool] = True
    daily_digest: Optional[bool] = True

class BusinessOut(BaseModel):
    id: int
    name: str
    keywords: Optional[str]
    alert_email: Optional[str]
    alert_on_negative: bool
    daily_digest: bool
    reddit_enabled: Optional[bool] = True
    google_enabled: Optional[bool] = True
    is_active: Optional[bool] = True
    appstore_id: Optional[str] = None
    playstore_id: Optional[str] = None
    trustpilot_domain: Optional[str] = None
    class Config:
        from_attributes = True

class MentionOut(BaseModel):
    id: int
    source: Optional[str]
    content: Optional[str]
    url: Optional[str]
    author: Optional[str]
    language: Optional[str]
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    sentiment_reason: Optional[str]
    suggested_reply: Optional[str]
    is_resolved: bool
    image_url: Optional[str] = None
    subreddit: Optional[str] = None
    star_rating: Optional[int] = None
    author_avatar: Optional[str] = None
    fetched_at: datetime
    tags: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    topic: Optional[str] = None
    is_spam: Optional[bool] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# ── Auth Routes ───────────────────────────────────────────────────────────────

@app.post("/auth/signup", response_model=UserOut)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    user_count = db.query(User).count()
    if user_count >= 5:
        raise HTTPException(status_code=400, detail="This platform is currently in private beta. Maximum 5 accounts allowed. Contact waqas@senti.app to request access.")
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ── Business Routes ───────────────────────────────────────────────────────────

@app.post("/businesses", response_model=BusinessOut)
def create_business(business: BusinessCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_biz = Business(
        user_id=current_user.id,
        name=business.name,
        keywords=business.keywords,
        alert_email=business.alert_email or current_user.email,
        alert_on_negative=business.alert_on_negative,
        daily_digest=business.daily_digest
    )
    db.add(new_biz)
    db.commit()
    db.refresh(new_biz)
    return new_biz

@app.get("/businesses", response_model=List[BusinessOut])
def get_businesses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Business).filter(Business.user_id == current_user.id).all()

# ── Mention Routes ────────────────────────────────────────────────────────────

@app.get("/businesses/{business_id}/mentions", response_model=List[MentionOut])
def get_mentions(business_id: int, sentiment: Optional[str] = None, is_resolved: Optional[bool] = None, limit: int = 100, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    query = db.query(Mention).filter(Mention.business_id == business_id)
    if sentiment:
        query = query.filter(Mention.sentiment == sentiment)
    if is_resolved is not None:
        query = query.filter(Mention.is_resolved == is_resolved)
    return query.order_by(Mention.fetched_at.desc()).limit(limit).all()

@app.patch("/mentions/{mention_id}/resolve")
def resolve_mention(mention_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mention = db.query(Mention).join(Business).filter(Mention.id == mention_id, Business.user_id == current_user.id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    mention.is_resolved = True
    db.commit()
    return {"status": "resolved"}

@app.get("/businesses/{business_id}/stats")
def get_stats(business_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    from datetime import timedelta
    mentions = db.query(Mention).filter(Mention.business_id == business_id).all()
    now = datetime.utcnow()
    last_2h = now - timedelta(hours=2)
    last_24h = now - timedelta(hours=24)
    recent_neg = sum(1 for m in mentions if m.sentiment == "negative" and m.fetched_at and m.fetched_at >= last_2h)
    daily_neg = sum(1 for m in mentions if m.sentiment == "negative" and m.fetched_at and m.fetched_at >= last_24h)
    hourly_avg = daily_neg / 24.0
    spike_threshold = max(3, hourly_avg * 2 * 2)
    spike_detected = recent_neg >= spike_threshold
    total = len(mentions)
    positive = len([m for m in mentions if m.sentiment == "positive"])
    negative = len([m for m in mentions if m.sentiment == "negative"])
    neutral = len([m for m in mentions if m.sentiment == "neutral"])
    unresolved = len([m for m in mentions if not m.is_resolved])
    return {
        "total": total,
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "unresolved": unresolved,
        "sentiment_score": round((positive / total * 100) if total > 0 else 0, 1),
        "spike": spike_detected,
        "spike_count": recent_neg
    }

@app.get("/")
def root():
    return {"status": "Senti API is running", "version": "1.0.0"}

# ── Admin Endpoints ───────────────────────────────────────────────────────────
def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@app.get("/admin/stats")
def admin_stats(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    from sqlalchemy import func
    total_users = db.query(User).filter(User.is_admin == False).count()
    total_businesses = db.query(Business).count()
    total_mentions = db.query(Mention).count()
    active_businesses = db.query(Business).filter(Business.is_active == True).count()
    negative_mentions = db.query(Mention).filter(Mention.sentiment == "negative").count()
    positive_mentions = db.query(Mention).filter(Mention.sentiment == "positive").count()
    return {
        "total_users": total_users,
        "total_businesses": total_businesses,
        "total_mentions": total_mentions,
        "active_businesses": active_businesses,
        "negative_mentions": negative_mentions,
        "positive_mentions": positive_mentions,
    }

@app.get("/admin/customers")
def admin_customers(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_admin == False).all()
    result = []
    for user in users:
        businesses = db.query(Business).filter(Business.user_id == user.id).all()
        for biz in businesses:
            mention_count = db.query(Mention).filter(Mention.business_id == biz.id).count()
            negative_count = db.query(Mention).filter(Mention.business_id == biz.id, Mention.sentiment == "negative").count()
            positive_count = db.query(Mention).filter(Mention.business_id == biz.id, Mention.sentiment == "positive").count()
            last_mention = db.query(Mention).filter(Mention.business_id == biz.id).order_by(Mention.fetched_at.desc()).first()
            all_mentions = db.query(Mention).filter(Mention.business_id == biz.id).all()
            lang_counts = {}
            topic_counts = {}
            for m in all_mentions:
                if m.language: lang_counts[m.language] = lang_counts.get(m.language, 0) + 1
                if m.topic: topic_counts[m.topic] = topic_counts.get(m.topic, 0) + 1
            top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            has_multilingual = any(lang != 'en' and count > 0 for lang, count in lang_counts.items())
            multilingual_langs = [lang for lang, count in lang_counts.items() if lang != 'en' and count > 0]
            from datetime import timedelta
            now = datetime.utcnow()
            last_2h = now - timedelta(hours=2)
            recent_neg = sum(1 for m in all_mentions if m.sentiment=="negative" and m.fetched_at and m.fetched_at >= last_2h)
            daily_neg = sum(1 for m in all_mentions if m.sentiment=="negative" and m.fetched_at and m.fetched_at >= (now - timedelta(hours=24)))
            spike = recent_neg >= max(3, (daily_neg/24.0) * 2 * 2)
            result.append({
                "user_id": user.id,
                "user_email": user.email,
                "user_name": user.full_name,
                "user_created": user.created_at.isoformat() if user.created_at else None,
                "business_id": biz.id,
                "business_name": biz.name,
                "keywords": biz.keywords,
                "alert_email": biz.alert_email,
                "is_active": biz.is_active,
                "reddit_enabled": biz.reddit_enabled,
                "google_enabled": biz.google_enabled,
                "playstore_id": biz.playstore_id,
                "appstore_id": biz.appstore_id,
                "trustpilot_domain": biz.trustpilot_domain,
                "playstore_enabled": biz.playstore_enabled if biz.playstore_enabled is not None else True,
                "appstore_enabled": biz.appstore_enabled if biz.appstore_enabled is not None else True,
                "trustpilot_enabled": biz.trustpilot_enabled if biz.trustpilot_enabled is not None else True,
                "mention_count": mention_count,
                "negative_count": negative_count,
                "positive_count": positive_count,
                "sentiment_score": round(positive_count/mention_count*100) if mention_count > 0 else 0,
                "last_scan": last_mention.fetched_at.isoformat() if last_mention else None,
                "business_created": biz.created_at.isoformat() if biz.created_at else None,
                "top_topics": top_topics,
                "has_multilingual": has_multilingual,
                "multilingual_langs": multilingual_langs,
                "lang_counts": lang_counts,
                "spike": spike,
                "spike_count": recent_neg,
            })
    return result

@app.patch("/admin/businesses/{business_id}")
def admin_update_business(business_id: int, data: dict, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if "reddit_enabled" in data:
        biz.reddit_enabled = data["reddit_enabled"]
    if "google_enabled" in data:
        biz.google_enabled = data["google_enabled"]
    if "is_active" in data:
        biz.is_active = data["is_active"]
    if "keywords" in data:
        biz.keywords = data["keywords"]
    if "name" in data:
        biz.name = data["name"]
    if "alert_email" in data:
        biz.alert_email = data["alert_email"]
    if "appstore_id" in data:
        biz.appstore_id = data["appstore_id"]
    if "playstore_id" in data:
        biz.playstore_id = data["playstore_id"]
    if "trustpilot_domain" in data:
        biz.trustpilot_domain = data["trustpilot_domain"]
    if "playstore_enabled" in data:
        biz.playstore_enabled = data["playstore_enabled"]
    if "appstore_enabled" in data:
        biz.appstore_enabled = data["appstore_enabled"]
    if "trustpilot_enabled" in data:
        biz.trustpilot_enabled = data["trustpilot_enabled"]
    db.commit()
    return {"status": "updated"}

@app.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, data: dict, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "is_active" in data:
        businesses = db.query(Business).filter(Business.user_id == user_id).all()
        for biz in businesses:
            biz.is_active = data["is_active"]
    db.commit()
    return {"status": "updated"}

# Phase 1 Inbox Engagement Endpoints

@app.patch("/mentions/{mention_id}/tags")
def update_mention_tags(mention_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mention = db.query(Mention).filter(Mention.id == mention_id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    mention.tags = data.get("tags", "")
    db.commit()
    return {"status": "updated"}

@app.patch("/mentions/{mention_id}/assign")
def assign_mention(mention_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mention = db.query(Mention).filter(Mention.id == mention_id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    mention.assigned_to = data.get("assigned_to", None)
    db.commit()
    return {"status": "updated"}

@app.patch("/mentions/{mention_id}/notes")
def update_mention_notes(mention_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mention = db.query(Mention).filter(Mention.id == mention_id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    mention.notes = data.get("notes", None)
    db.commit()
    return {"status": "updated"}

@app.get("/businesses/{business_id}/saved-replies")
def get_saved_replies(business_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    rows = db.execute(text("SELECT id, title, content, created_at FROM saved_replies WHERE business_id = :bid ORDER BY created_at DESC"), {"bid": business_id}).fetchall()
    return [{"id": r[0], "title": r[1], "content": r[2], "created_at": str(r[3])} for r in rows]

@app.post("/businesses/{business_id}/saved-replies")
def create_saved_reply(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    db.execute(text("INSERT INTO saved_replies (business_id, title, content) VALUES (:bid, :title, :content)"), {"bid": business_id, "title": data.get("title"), "content": data.get("content")})
    db.commit()
    return {"status": "created"}

@app.delete("/saved-replies/{reply_id}")
def delete_saved_reply(reply_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    db.execute(text("DELETE FROM saved_replies WHERE id = :id"), {"id": reply_id})
    db.commit()
    return {"status": "deleted"}

@app.get("/businesses/{business_id}/mentions/search")
def search_mentions(business_id: int, q: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    mentions = db.query(Mention).filter(
        Mention.business_id == business_id,
        Mention.content.ilike(f"%{q}%")
    ).order_by(Mention.fetched_at.desc()).limit(50).all()
    return mentions

# AI Analyst Endpoint
@app.post("/businesses/{business_id}/ai-analyst")
async def ai_analyst(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    question = data.get("question", "")
    history = data.get("history", [])
    if not question:
        raise HTTPException(status_code=400, detail="Question required")
    try:
        from sqlalchemy import text as sqlt
        db.execute(sqlt("INSERT INTO ai_usage (business_id, user_id, event_type) VALUES (:bid, :uid, :evt)"), {"bid": business_id, "uid": current_user.id, "evt": "ai_analyst_question"})
        db.commit()
    except:
        pass
    from datetime import timedelta
    now2 = datetime.utcnow()
    today_str = now2.strftime("%Y-%m-%d")
    last_2h = now2 - timedelta(hours=2)
    last_24h = now2 - timedelta(hours=24)

    mentions = db.query(Mention).filter(Mention.business_id == business_id).order_by(Mention.fetched_at.desc()).limit(200).all()
    total = len(mentions)
    positive = sum(1 for m in mentions if m.sentiment == "positive")
    negative = sum(1 for m in mentions if m.sentiment == "negative")
    neutral = sum(1 for m in mentions if m.sentiment == "neutral")
    score = round(positive/total*100) if total > 0 else 0

    today_mentions = [m for m in mentions if m.fetched_at and m.fetched_at.strftime("%Y-%m-%d") == today_str]
    today_neg = [m for m in today_mentions if m.sentiment == "negative"]
    today_pos = [m for m in today_mentions if m.sentiment == "positive"]

    recent_neg = sum(1 for m in mentions if m.sentiment == "negative" and m.fetched_at and m.fetched_at >= last_2h)
    daily_neg = sum(1 for m in mentions if m.sentiment == "negative" and m.fetched_at and m.fetched_at >= last_24h)
    hourly_avg = daily_neg / 24.0
    spike_threshold = max(3, hourly_avg * 2 * 2)
    spike_detected = recent_neg >= spike_threshold

    topics = {}
    for m in mentions:
        if m.topic:
            topics[m.topic] = topics.get(m.topic, 0) + 1
    top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]

    sources = {}
    for m in mentions:
        if m.source:
            sources[m.source] = sources.get(m.source, 0) + 1

    def fmt_mention(m, max_len=300):
        date_tag = "[TODAY]" if m.fetched_at and m.fetched_at.strftime("%Y-%m-%d") == today_str else ("[" + m.fetched_at.strftime("%Y-%m-%d") + "]" if m.fetched_at else "[unknown date]")
        author = m.author or "anonymous"
        rating = f" rating={m.rating}" if hasattr(m, "rating") and m.rating else ""
        return f"{date_tag} [{m.source}]{rating} @{author}: {m.content[:max_len]}"

    all_neg = [m for m in mentions if m.sentiment == "negative"]
    all_pos = [m for m in mentions if m.sentiment == "positive"]
    neg_lines = chr(10).join([fmt_mention(m) for m in all_neg[:20]])
    pos_lines = chr(10).join([fmt_mention(m) for m in all_pos[:10]])
    today_neg_lines = chr(10).join([fmt_mention(m) for m in today_neg]) if today_neg else "None today."
    today_pos_lines = chr(10).join([fmt_mention(m) for m in today_pos]) if today_pos else "None today."

    context = f"""You are the AI Brand Analyst for {biz.name}. Today is {today_str} (UTC: {now2.strftime("%H:%M")}).

REAL-TIME STATS:
- Total mentions: {total} | Score: {score}/100
- Positive: {positive} | Negative: {negative} | Neutral: {neutral}
- Today ({today_str}): {len(today_mentions)} total, {len(today_neg)} negative, {len(today_pos)} positive
- Last 2h negative: {recent_neg} | Spike: {"YES CRISIS" if spike_detected else "No"}

TOP TOPICS:
{chr(10).join([f'- {t}: {c} mentions' for t,c in top_topics])}

SOURCES:
{chr(10).join([f'- {s}: {c} mentions' for s,c in sources.items()])}

TODAY'S NEGATIVE REVIEWS:
{today_neg_lines}

TODAY'S POSITIVE REVIEWS:
{today_pos_lines}

ALL RECENT NEGATIVE MENTIONS (up to 20, newest first):
{neg_lines}

ALL RECENT POSITIVE MENTIONS (up to 10, newest first):
{pos_lines}

RULES:
- Use ONLY the data above. Never say "I don't have access to" or "based on provided data".
- For today questions use only [TODAY] mentions. If none say "No mentions today."
- Quote actual review text to be specific.
- Be direct and professional. 3-5 sentences unless asked for a list.
- Always end with one concrete action recommendation."""

    try:
        import httpx as _httpx
        groq_key = os.getenv("GROQ_API_KEY", "")
        res = _httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": "openai/gpt-oss-120b", "messages": [{"role": "system", "content": context}] + [{"role": m["role"], "content": m["content"]} for m in history] + [{"role": "user", "content": question}], "max_tokens": 600, "temperature": 0.2},
            timeout=30
        )
        answer = res.json()["choices"][0]["message"]["content"]
        return {"answer": answer, "data": {"total": total, "score": score, "positive": positive, "negative": negative, "top_topics": top_topics}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/suggest-keywords")
async def suggest_keywords(data: dict, current_user: User = Depends(get_current_user)):
    import httpx, os
    mode = data.get("mode", "business")
    answers = data.get("answers", {})
    groq_key = os.getenv("GROQ_API_KEY", "")

    if mode == "business":
        name = answers.get("name", "")
        informal = answers.get("informal", "")
        region = answers.get("region", "Canada")
        prompt = f"""You are helping a business owner set up keyword monitoring for their brand "{name}".
Informal names or nicknames: {informal}
Region: {region}

Generate 5-8 comma-separated search keywords they should monitor on Reddit and Google Reviews.
Include: exact name, common misspellings, short forms, regional variants.
Reply with ONLY the comma-separated keywords, nothing else. No explanation."""

    else:
        competitor_name = answers.get("name", "")
        region = answers.get("region", "Canada")
        prompt = f"""You are helping monitor a competitor called "{competitor_name}" in {region}.
Generate 5-7 comma-separated search keywords to find mentions of this competitor on Reddit and Google.
Include: exact name, abbreviations, common misspellings, product names if well known.
Reply with ONLY the comma-separated keywords, nothing else. No explanation."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": prompt}], "max_tokens": 100, "temperature": 0.3}
            )
            keywords = r.json()["choices"][0]["message"]["content"].strip()
            return {"keywords": keywords}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/businesses/{business_id}")
async def update_business(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    allowed = ["name","keywords","alert_email","alert_on_negative","daily_digest","appstore_id","playstore_id","trustpilot_domain","reddit_enabled","google_enabled","playstore_enabled","appstore_enabled","trustpilot_enabled"]
    for key, val in data.items():
        if key in allowed:
            setattr(biz, key, val)
    db.commit()
    db.refresh(biz)
    return {"id": biz.id, "name": biz.name, "keywords": biz.keywords}



# ── TEAMS ────────────────────────────────────────────────────────────────────

class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    email = Column(String)
    full_name = Column(String, nullable=True)
    role = Column(String, default="agent")
    status = Column(String, default="pending")
    invited_at = Column(DateTime, default=datetime.utcnow)
    joined_at = Column(DateTime, nullable=True)

@app.get("/businesses/{business_id}/team")
async def get_team(business_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    members = db.query(TeamMember).filter(TeamMember.business_id == business_id).all()
    from sqlalchemy import text as sqlt
    result = []
    # Add owner first
    result.append({
        "id": 0,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": "owner",
        "status": "active",
        "invited_at": None,
        "joined_at": None,
        "assigned_count": db.execute(sqlt("SELECT COUNT(*) FROM mentions WHERE business_id=:bid AND assigned_to=:email"), {"bid": business_id, "email": current_user.email}).scalar() or 0
    })
    for m in members:
        assigned_count = db.execute(sqlt("SELECT COUNT(*) FROM mentions WHERE business_id=:bid AND assigned_to=:email"), {"bid": business_id, "email": m.email}).scalar() or 0
        result.append({
            "id": m.id,
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
            "status": m.status,
            "invited_at": m.invited_at.strftime("%b %d %Y") if m.invited_at else None,
            "joined_at": m.joined_at.strftime("%b %d %Y") if m.joined_at else None,
            "assigned_count": assigned_count
        })
    return result

@app.post("/businesses/{business_id}/team/invite")
async def invite_team_member(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    email = data.get("email","").strip().lower()
    role = data.get("role","agent")
    full_name = data.get("full_name","").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    if email == current_user.email:
        raise HTTPException(status_code=400, detail="You are already the owner")
    existing = db.query(TeamMember).filter(TeamMember.business_id == business_id, TeamMember.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Member already invited")
    member = TeamMember(business_id=business_id, email=email, full_name=full_name, role=role, status="pending")
    db.add(member)
    db.commit()
    db.refresh(member)
    # Send invite email
    try:
        import httpx, os
        resend_key = os.getenv("RESEND_API_KEY","")
        if resend_key:
            httpx.post("https://api.resend.com/emails",
                headers={"Authorization":f"Bearer {resend_key}","Content-Type":"application/json"},
                json={
                    "from":"Senti <onboarding@resend.dev>",
                    "to":[email],
                    "subject":f"You've been invited to join {biz.name} on Senti",
                    "html":f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                    <div style="background:#7C3AED;padding:20px;border-radius:8px 8px 0 0">
                        <h2 style="color:white;margin:0">You're invited to Senti</h2>
                        <p style="color:#DDD6FE;margin:5px 0 0">Brand reputation monitoring</p>
                    </div>
                    <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
                        <p style="font-size:15px;color:#111">{current_user.full_name or current_user.email} has invited you to join <strong>{biz.name}</strong> on Senti as a <strong>{role}</strong>.</p>
                        <a href="https://senti-community.vercel.app/signup" style="background:#7C3AED;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:15px 0">Accept invitation</a>
                        <p style="color:#6b7280;font-size:13px">Sign up with this email address ({email}) to join the team.</p>
                    </div>
                    </div>"""
                }, timeout=10)
    except Exception as e:
        print(f"Invite email error: {e}")
    return {"id": member.id, "email": member.email, "role": member.role, "status": member.status}

@app.patch("/businesses/{business_id}/team/{member_id}")
async def update_team_member(business_id: int, member_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    member = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.business_id == business_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if "role" in data:
        member.role = data["role"]
    db.commit()
    return {"ok": True}

@app.delete("/businesses/{business_id}/team/{member_id}")
async def remove_team_member(business_id: int, member_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    member = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.business_id == business_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"ok": True}

@app.get("/my-team")
async def get_my_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(TeamMember).filter(TeamMember.email == current_user.email, TeamMember.status == "active").all()
    result = []
    for m in memberships:
        biz = db.query(Business).filter(Business.id == m.business_id).first()
        if biz:
            result.append({"business_id": m.business_id, "business_name": biz.name, "role": m.role})
    return result

# ── AI AGENT ─────────────────────────────────────────────────────────────────

class AgentSettings(Base):
    __tablename__ = "agent_settings"
    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), unique=True)
    enabled = Column(Boolean, default=False)
    auto_resolve = Column(Boolean, default=False)
    auto_escalate = Column(Boolean, default=False)
    auto_draft = Column(Boolean, default=False)
    escalate_threshold = Column(Float, default=0.3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class AgentAction(Base):
    __tablename__ = "agent_actions"
    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    mention_id = Column(Integer, ForeignKey("mentions.id"))
    action_type = Column(String)
    detail = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

@app.get("/businesses/{business_id}/agent")
async def get_agent_settings(business_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    settings = db.query(AgentSettings).filter(AgentSettings.business_id == business_id).first()
    if not settings:
        settings = AgentSettings(business_id=business_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    actions = db.query(AgentAction).filter(AgentAction.business_id == business_id).order_by(AgentAction.created_at.desc()).limit(20).all()
    return {
        "enabled": settings.enabled,
        "auto_resolve": settings.auto_resolve,
        "auto_escalate": settings.auto_escalate,
        "auto_draft": settings.auto_draft,
        "escalate_threshold": settings.escalate_threshold,
        "actions": [{"id": a.id, "action_type": a.action_type, "detail": a.detail, "created_at": a.created_at.strftime("%b %d %H:%M") if a.created_at else ""} for a in actions]
    }

@app.patch("/businesses/{business_id}/agent")
async def update_agent_settings(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    settings = db.query(AgentSettings).filter(AgentSettings.business_id == business_id).first()
    if not settings:
        settings = AgentSettings(business_id=business_id)
        db.add(settings)
    for key in ["enabled","auto_resolve","auto_escalate","auto_draft","escalate_threshold"]:
        if key in data:
            setattr(settings, key, data[key])
    settings.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

# ── COMPETITOR TRACKING ─────────────────────────────────────────────────────

class Competitor(Base):
    __tablename__ = "competitors"
    id = Column(Integer, primary_key=True)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    name = Column(String)
    keywords = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class CompetitorMention(Base):
    __tablename__ = "competitor_mentions"
    id = Column(Integer, primary_key=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"))
    business_id = Column(Integer, ForeignKey("businesses.id"))
    source = Column(String)
    content = Column(Text)
    url = Column(String)
    author = Column(String)
    sentiment = Column(String)
    sentiment_score = Column(Float)
    topic = Column(String)
    star_rating = Column(Integer)
    fetched_at = Column(DateTime, default=datetime.utcnow)

@app.get("/businesses/{business_id}/competitors")
async def get_competitors(business_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    competitors = db.query(Competitor).filter(Competitor.business_id == business_id).all()
    result = []
    for c in competitors:
        mentions = db.query(CompetitorMention).filter(CompetitorMention.competitor_id == c.id).all()
        total = len(mentions)
        positive = sum(1 for m in mentions if m.sentiment == "positive")
        negative = sum(1 for m in mentions if m.sentiment == "negative")
        neutral = sum(1 for m in mentions if m.sentiment == "neutral")
        score = round(positive/total*100) if total > 0 else 0
        result.append({
            "id": c.id,
            "name": c.name,
            "keywords": c.keywords,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "score": score,
            "recent_mentions": [{"content": m.content[:200], "sentiment": m.sentiment, "source": m.source, "fetched_at": m.fetched_at.strftime("%b %d") if m.fetched_at else ""} for m in sorted(mentions, key=lambda x: x.fetched_at or datetime.min, reverse=True)[:3]]
        })
    return result

@app.post("/businesses/{business_id}/competitors")
async def add_competitor(business_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    existing = db.query(Competitor).filter(Competitor.business_id == business_id).count()
    if existing >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 competitors allowed")
    name = data.get("name", "").strip()
    keywords = data.get("keywords", "").strip()
    if not name or not keywords:
        raise HTTPException(status_code=400, detail="Name and keywords required")
    competitor = Competitor(business_id=business_id, name=name, keywords=keywords)
    db.add(competitor)
    db.commit()
    db.refresh(competitor)
    return {"id": competitor.id, "name": competitor.name, "keywords": competitor.keywords, "total": 0, "positive": 0, "negative": 0, "neutral": 0, "score": 0, "recent_mentions": []}

@app.delete("/businesses/{business_id}/competitors/{competitor_id}")
async def delete_competitor(business_id: int, competitor_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    competitor = db.query(Competitor).filter(Competitor.id == competitor_id, Competitor.business_id == business_id).first()
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    db.query(CompetitorMention).filter(CompetitorMention.competitor_id == competitor_id).delete()
    db.delete(competitor)
    db.commit()
    return {"ok": True}

@app.post("/businesses/{business_id}/competitors/{competitor_id}/scan")
async def scan_competitor(business_id: int, competitor_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    competitor = db.query(Competitor).filter(Competitor.id == competitor_id, Competitor.business_id == business_id).first()
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    count = await fetch_competitor_mentions(competitor, business_id, db)
    return {"ok": True, "fetched": count}

async def fetch_competitor_mentions(competitor, business_id: int, db):
    import httpx
    from urllib.parse import quote_plus
    import xml.etree.ElementTree as ET
    keywords = [k.strip() for k in competitor.keywords.split(",") if k.strip()]
    count = 0
    existing_urls = {m.url for m in db.query(CompetitorMention).filter(CompetitorMention.competitor_id == competitor.id).all()}
    for keyword in keywords:
        try:
            encoded = quote_plus(keyword)
            url = f"https://www.reddit.com/search.rss?q={encoded}&sort=new&limit=15"
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(url, headers={"User-Agent": "Senti/1.0 social listening tool"})
                if r.status_code != 200:
                    print(f"Competitor RSS status {r.status_code} for {keyword}")
                    continue
                root = ET.fromstring(r.text)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                entries = root.findall("atom:entry", ns)
                print(f"Competitor {competitor.name}: {len(entries)} entries for keyword '{keyword}'")
                for entry in entries:
                    import re, html as _html
                    link = entry.find("atom:link", ns)
                    post_url = link.get("href", "") if link is not None else ""
                    if not post_url or post_url in existing_urls:
                        continue
                    title_el = entry.find("atom:title", ns)
                    content_el = entry.find("atom:content", ns)
                    author_el = entry.find("atom:author/atom:name", ns)
                    title_text = title_el.text if title_el is not None else ""
                    content_text = content_el.text if content_el is not None else ""
                    author = author_el.text if author_el is not None else "reddit_user"
                    if author and "/" in author:
                        author = author.split("/")[-1]
                    # Strip HTML and clean text
                    full_text = re.sub(r"<[^>]+>", " ", f"{title_text} {content_text}")
                    full_text = _html.unescape(full_text)
                    full_text = re.sub(r"\s+", " ", full_text).strip()[:2000]
                    # Strict filter: keyword in title OR 3+ times in content
                    full_lower = full_text.lower()
                    title_lower = title_text.lower()
                    kw_list = [k.strip().lower() for k in competitor.keywords.split(",") if k.strip()] + [competitor.name.lower()]
                    # Only use keywords with 4+ chars to avoid false matches like SC, KG etc
                    kw_list = [kw for kw in kw_list if len(kw) >= 4]
                    if not kw_list:
                        kw_list = [competitor.name.lower()]
                    in_title = any(kw in title_lower for kw in kw_list)
                    in_content_thrice = any(full_lower.count(kw) >= 3 for kw in kw_list)
                    if not in_title and not in_content_thrice:
                        print(f"Competitor: skipping irrelevant post: {title_text[:60]}")
                        continue
                    sentiment, score = await analyze_sentiment_competitor(full_text)
                    m = CompetitorMention(
                        competitor_id=competitor.id,
                        business_id=business_id,
                        source="Reddit",
                        content=full_text[:500],
                        url=post_url,
                        author=author,
                        sentiment=sentiment,
                        sentiment_score=score,
                    )
                    db.add(m)
                    existing_urls.add(post_url)
                    count += 1
        except Exception as e:
            print(f"Competitor RSS error for {keyword}: {e}")
    db.commit()
    return count

async def analyze_sentiment_competitor(text: str):
    try:
        import httpx, os, json
        groq_key = os.getenv("GROQ_API_KEY", "")
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": f"Classify sentiment as positive, negative, or neutral. Reply with only one word.\n\nText: {text[:300]}"}], "max_tokens": 5, "temperature": 0}
            )
            word = r.json()["choices"][0]["message"]["content"].strip().lower()
            if "positive" in word: return "positive", 0.8
            if "negative" in word: return "negative", 0.2
            return "neutral", 0.5
    except:
        return "neutral", 0.5

# Admin AI Features Endpoints

@app.get("/admin/ai-stats")
def admin_ai_stats(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    from datetime import timedelta
    from sqlalchemy import func
    businesses = db.query(Business).all()
    result = []
    for biz in businesses:
        mentions = db.query(Mention).filter(Mention.business_id == biz.id).all()
        total = len(mentions)
        spam_count = sum(1 for m in mentions if m.is_spam == True)
        topics = {}
        for m in mentions:
            if m.topic:
                topics[m.topic] = topics.get(m.topic, 0) + 1
        top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]
        now = datetime.utcnow()
        last_2h = now - timedelta(hours=2)
        last_24h = now - timedelta(hours=24)
        recent_neg = sum(1 for m in mentions if m.sentiment=="negative" and m.fetched_at and m.fetched_at >= last_2h)
        daily_neg = sum(1 for m in mentions if m.sentiment=="negative" and m.fetched_at and m.fetched_at >= last_24h)
        hourly_avg = daily_neg / 24.0
        spike_threshold = max(3, hourly_avg * 2 * 2)
        spike = recent_neg >= spike_threshold
        positive = sum(1 for m in mentions if m.sentiment=="positive")
        negative = sum(1 for m in mentions if m.sentiment=="negative")
        score = round(positive/total*100) if total > 0 else 0
        last_week = now - timedelta(days=7)
        last_week_mentions = [m for m in mentions if m.fetched_at and m.fetched_at >= last_week]
        last_week_score = round(sum(1 for m in last_week_mentions if m.sentiment=="positive")/len(last_week_mentions)*100) if last_week_mentions else 0
        prev_week = now - timedelta(days=14)
        prev_week_mentions = [m for m in mentions if m.fetched_at and m.fetched_at >= prev_week and m.fetched_at < last_week]
        prev_week_score = round(sum(1 for m in prev_week_mentions if m.sentiment=="positive")/len(prev_week_mentions)*100) if prev_week_mentions else 0
        trend = "declining" if spike else "improving" if last_week_score > prev_week_score else "declining" if last_week_score < prev_week_score else "stable"
        from sqlalchemy import text as sqlt
        ai_questions = db.execute(sqlt("SELECT COUNT(*) FROM ai_usage WHERE business_id=:bid AND event_type='ai_analyst_question'"), {"bid": biz.id}).scalar() or 0
        sentiment_analyses = total
        result.append({
            "business_id": biz.id,
            "business_name": biz.name,
            "total_mentions": total,
            "spam_blocked": spam_count,
            "sentiment_score": score,
            "trend": trend,
            "spike": spike,
            "spike_count": recent_neg,
            "top_topics": top_topics,
            "health": "critical" if spike else "warning" if score < 40 else "good" if score >= 60 else "fair",
            "ai_questions": ai_questions,
            "sentiment_analyses": sentiment_analyses,
            "ai_total_usage": ai_questions + sentiment_analyses
        })
    return result

@app.get("/admin/spike-history")
def admin_spike_history(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    from datetime import timedelta
    businesses = db.query(Business).all()
    result = []
    for biz in businesses:
        for hours_ago in [2, 6, 12, 24, 48]:
            cutoff = datetime.utcnow() - timedelta(hours=hours_ago)
            neg_count = db.query(Mention).filter(
                Mention.business_id == biz.id,
                Mention.sentiment == "negative",
                Mention.fetched_at >= cutoff
            ).count()
            result.append({
                "business_name": biz.name,
                "period": f"Last {hours_ago}h",
                "negative_count": neg_count
            })
    return result
