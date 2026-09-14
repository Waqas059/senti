import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Was '' on the old server because nginx served the frontend and API on the
// same origin with no prefix. On Vercel, the Python API lives under /api
// (see vercel.json), so requests now need that prefix. Still relative, so
// this keeps working unchanged whether you're on localhost or on Vercel.
const API = process.env.REACT_APP_API_URL || '/api';
const api = axios.create({ baseURL: API });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  // Sidebar
  sbBg: '#1E2433',
  sbBorder: 'rgba(255,255,255,0.05)',
  sbText: 'rgba(255,255,255,0.42)',
  sbTextActive: '#E0D9FF',
  sbTextMuted: 'rgba(255,255,255,0.22)',
  // Content
  pageBg: '#F4F2F9',
  cardBg: '#fff',
  cardBorder: '#EAE5F2',
  // Text
  textPrimary: '#130826',
  textSecondary: '#6B5E8C',
  textMuted: '#9F8EC4',
  textHint: '#C4B5FD',
  // Brand
  purple: '#7C3AED',
  purpleLight: '#F0EDF8',
  purpleMid: '#E2DAF0',
  purpleSoft: '#F5F2FC',
  // Semantic
  green: '#16A34A',
  greenLight: '#F0FDF4',
  greenBorder: '#BBF7D0',
  red: '#DC2626',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  amberBorder: '#FDE68A',
  blue: '#0095FF',
  // Neutrals
  gray50: '#F7F5FB',
  gray100: '#EAE5F2',
  gray200: '#DDD8EC',
  gray400: '#A090C0',
  gray500: '#8A7AAE',
  gray600: '#7A6B96',
  white: '#fff',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name || name === 'reddit_user') return 'U';
  return name.split(/[_\s]/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function getAvatarColor(name) {
  const colors = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#7C3AED','#E63946','#0095FF','#14B8A6'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function getSubredditColor(sub) {
  const map = { canada:'#FF4500', toronto:'#E63946', ukraine:'#0057B7', food:'#F4A261', news:'#6B7280' };
  if (!sub) return '#6366F1';
  const l = sub.toLowerCase();
  for (const [k, c] of Object.entries(map)) if (l.includes(k)) return c;
  const colors = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6'];
  let hash = 0;
  for (let i = 0; i < sub.length; i++) hash = sub.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}
function sentimentColors(s) {
  if (s === 'positive') return { bg: T.greenLight, text: '#166534', border: T.green, dot: T.green };
  if (s === 'negative') return { bg: T.redLight, text: '#991B1B', border: T.red, dot: T.red };
  return { bg: T.purpleLight, text: '#5B21B6', border: '#A78BFA', dot: '#A78BFA' };
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Avatar({ name, size = 34 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 9, background: getAvatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

function Pill({ label, color, bg, border }) {
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, border: border ? `1px solid ${border}` : 'none', whiteSpace: 'nowrap' }}>{label}</span>;
}

function Badge({ label, up }) {
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: up ? T.greenLight : T.redLight, color: up ? '#166534' : '#991B1B', display: 'inline-flex', alignItems: 'center', gap: 2 }}>{up ? '▲' : '▼'} {label}</span>;
}

function StarRating({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 11, color: n <= rating ? '#F59E0B' : T.gray200 }}>★</span>)}
    </div>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background: T.cardBg, borderRadius: 11, border: `1px solid ${T.cardBorder}`, padding: 16, ...style }}>{children}</div>;
}

function CardTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>{children}</div>;
}

function CardSub({ children }) {
  return <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 12 }}>{children}</div>;
}

function MetricCard({ label, value, suffix, change, color, icon, dark, onClick }) {
  const isUp = change > 0;
  return (
    <div onClick={onClick} style={{ background: dark ? 'linear-gradient(135deg, #4C1D95, #7C3AED)' : T.cardBg, borderRadius: 11, padding: 16, border: dark ? 'none' : `1px solid ${T.cardBorder}`, cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        {icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: dark ? 'rgba(255,255,255,0.08)' : T.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: dark ? 'rgba(255,255,255,0.5)' : T.purple }}><i className={`ti ${icon}`} aria-hidden="true"></i></div>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.3)' : T.gray400, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: dark ? T.white : (color || T.textPrimary), letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span style={{ fontSize: 14, color: dark ? 'rgba(255,255,255,0.25)' : T.gray400, fontWeight: 500 }}>{suffix}</span>}
      </div>
      {change !== undefined && change !== null && (
        <Badge label={`${Math.abs(change)}% vs prev`} up={isUp} />
      )}
      {change === undefined && <span style={{ fontSize: 9, color: dark ? 'rgba(255,255,255,0.2)' : T.gray400 }}>All time</span>}
    </div>
  );
}

function BarTrack({ pct, color }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: T.purpleLight, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.4s' }} />
    </div>
  );
}

function ActionBtn({ label, icon, variant = 'ghost', onClick }) {
  const styles = {
    primary: { background: T.purple, color: T.white, border: 'none' },
    ghost: { background: T.purpleSoft, color: T.purple, border: `1px solid ${T.purpleMid}` },
    success: { background: T.greenLight, color: T.green, border: `1px solid ${T.greenBorder}` },
    danger: { background: T.redLight, color: T.red, border: `1px solid ${T.redBorder}` },
  };
  return (
    <button onClick={e => { e.stopPropagation(); onClick && onClick(); }} style={{ fontSize: 10, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, ...styles[variant] }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 11 }} aria-hidden="true"></i>}
      {label}
    </button>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ dateRange, setDateRange, onRefresh }) {
  return (
    <div style={{ height: 46, background: T.white, borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', padding: '0 22px', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.green, fontWeight: 600, background: T.greenLight, padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.greenBorder}` }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, flexShrink: 0 }}></span>Live
        </div>
        <span style={{ fontSize: 11, color: T.textMuted }}>{new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>

    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, business, user, stats, onLogout }) {
  const monitor = [
    { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
    { id: 'inbox', icon: 'ti-inbox', label: 'Inbox', badge: stats?.unresolved },
    { id: 'analytics', icon: 'ti-chart-area', label: 'Analytics' },
  ];
  const manage = [
    { id: 'business', icon: 'ti-building-store', label: 'My business' },
    { id: 'ai-analyst', icon: 'ti-brain', label: 'AI Analyst' },
    { id: 'ai-agent', icon: 'ti-robot', label: 'AI Agent', badge: 'On', badgeGreen: true },
    { id: 'competitors', icon: 'ti-trophy', label: 'Competitors' },
    { id: 'team', icon: 'ti-users', label: 'Team' },
    { id: 'alerts', icon: 'ti-bell', label: 'Alerts' },
    { id: 'settings', icon: 'ti-settings', label: 'Settings' },
  ];
  const NavItem = ({ item }) => (
    <div onClick={() => setActive(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', paddingLeft: active === item.id ? 8 : 10, borderRadius: 8, cursor: 'pointer', fontSize: 12, color: active === item.id ? T.sbTextActive : T.sbText, fontWeight: active === item.id ? 600 : 500, marginBottom: 1, background: active === item.id ? 'rgba(124,58,237,0.12)' : 'transparent', borderLeft: active === item.id ? `2px solid ${T.purple}` : '2px solid transparent', transition: 'all 0.12s' }}>
      <i className={`ti ${item.icon}`} style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true"></i>
      {item.label}
      {item.badge && item.badge !== 'On' && <span style={{ marginLeft: 'auto', background: '#EF4444', color: T.white, fontSize: 8, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>{item.badge}</span>}
      {item.badge === 'On' && <span style={{ marginLeft: 'auto', background: item.badgeGreen ? T.green : T.purple, color: T.white, fontSize: 8, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>On</span>}
    </div>
  );
  return (
    <div style={{ width: 240, background: T.sbBg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${T.sbBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: T.white, flexShrink: 0 }}>S</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.white, letterSpacing: '-0.02em', lineHeight: 1 }}>Senti</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 2, letterSpacing: '0.03em' }}>CXM Platform</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.sbTextMuted, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 8px 5px' }}>Monitor</div>
        {monitor.map(item => <NavItem key={item.id} item={item} />)}
        <div style={{ fontSize: 9, fontWeight: 700, color: T.sbTextMuted, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 8px 5px' }}>Manage</div>
        {manage.map(item => <NavItem key={item.id} item={item} />)}
      </div>
      <div style={{ margin: '4px 10px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 9, padding: '10px 12px' }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Currently monitoring</div>
        <div style={{ fontSize: 12, color: T.white, fontWeight: 700, marginBottom: 5 }}>{business?.name || 'No business'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, flexShrink: 0 }}></span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Live · scans every hour</span>
        </div>
      </div>
      <div style={{ padding: '11px 14px', borderTop: `1px solid ${T.sbBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.white, flexShrink: 0 }}>{user?.full_name?.charAt(0) || 'U'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name || 'User'}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Account owner</div>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 15, padding: 2 }} title="Sign out">
          <i className="ti ti-logout" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
function Page({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', background: T.pageBg }}>{children}</div>;
}

function PageHead({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.02em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Mention card ─────────────────────────────────────────────────────────────
function MentionCard({ mention, onResolve, businessId, savedReplies = [] }) {
  const [expanded, setExpanded] = React.useState(false);
  const [showReply, setShowReply] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [showSavedReplies, setShowSavedReplies] = React.useState(false);
  const [aiAnswer, setAiAnswer] = React.useState('');
  const [loadingAI, setLoadingAI] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [showAI, setShowAI] = React.useState(false);
  const [tags, setTags] = React.useState(mention.tags || '');
  const [assignTo, setAssignTo] = React.useState(mention.assigned_to || '');
  const [notes, setNotes] = React.useState(mention.notes || '');
  const [savingMeta, setSavingMeta] = React.useState(false);
  const [metaSaved, setMetaSaved] = React.useState(false);
  const sc = sentimentColors(mention.sentiment);
  const borderColor = mention.is_resolved ? T.gray200 : sc.border;

  const resolve = async () => {
    try { await api.patch(`/mentions/${mention.id}/resolve`); onResolve && onResolve(mention.id); } catch {}
  };

  const askAI = async () => {
    if (!question.trim()) return;
    setLoadingAI(true);
    try {
      const context = "You are a helpful CX assistant. Answer questions about this mention. Mention author: " + (mention.author || "Unknown") + ". Source: " + (mention.source || "Unknown") + ". Sentiment: " + (mention.sentiment || "Unknown") + ". Content: " + (mention.content || "") + ". Current suggested reply: " + (mention.suggested_reply || "None") + ". If asked to improve or rewrite the reply: provide a warm specific improved reply only, no preamble. If asked a question: answer in 2-3 sentences. Be direct and practical.";

      const res = await api.post("/businesses/" + (businessId || mention.business_id || 0) + "/ai-analyst", {
        question: context + " User question: " + question,
        history: []
      });
      setAiAnswer(res.data.answer || 'Could not get answer.');
    } catch { setAiAnswer('Could not connect to AI.'); }
    setLoadingAI(false);
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await Promise.all([
        api.patch(`/mentions/${mention.id}/tags`, { tags }),
        api.patch(`/mentions/${mention.id}/assign`, { assigned_to: assignTo }),
        api.patch(`/mentions/${mention.id}/notes`, { notes }),
      ]);
      setMetaSaved(true); setTimeout(() => setMetaSaved(false), 2000);
    } catch {}
    setSavingMeta(false);
  };

  return (
    <div style={{ background: T.white, borderRadius: 10, borderLeft: '3px solid ' + borderColor, border: '1px solid ' + T.cardBorder, borderLeftWidth: 3, borderLeftColor: borderColor, marginBottom: 8, opacity: mention.is_resolved ? 0.45 : 1 }}>
      <div style={{ padding: '11px 13px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', gap: 9 }}>
          <Avatar name={mention.author} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{mention.author || mention.source}</span>
                <Pill label={mention.sentiment || 'unknown'} color={sc.text} bg={sc.bg} />
                {mention.source === 'Reddit' && mention.subreddit && <Pill label={'r/' + mention.subreddit} color={getSubredditColor(mention.subreddit)} bg={getSubredditColor(mention.subreddit) + '15'} />}
                {mention.source === 'Google Reviews' && <Pill label="Google" color="#3730A3" bg="#EEF2FF" />}
                {mention.source === 'Play Store' && <Pill label="Play Store" color="#166534" bg="#F0FDF4" />}
                {mention.source === 'App Store' && <Pill label="App Store" color="#1D4ED8" bg="#EFF6FF" />}
                {mention.star_rating && <StarRating rating={mention.star_rating} />}
                {mention.topic && <Pill label={mention.topic} color={T.purple} bg={T.purpleLight} />}
                {tags && tags.split(',').filter(t => t.trim()).map(t => <Pill key={t} label={t.trim()} color={T.blue} bg="#E0F2FF" />)}
                {assignTo && <Pill label={'→ ' + assignTo} color={T.amber} bg={T.amberLight} />}
              </div>
              <span style={{ fontSize: 9, color: T.textHint, whiteSpace: 'nowrap' }}>{timeAgo(mention.posted_at || mention.fetched_at)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#2D1B69', lineHeight: 1.65 }}>{expanded ? mention.content : (mention.content || '').slice(0, 160) + ((mention.content || '').length > 160 ? '…' : '')}</div>
            {notes && <div style={{ fontSize: 10, color: T.amber, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-notes" style={{ fontSize: 10 }} aria-hidden="true"></i>{notes.slice(0, 80)}{notes.length > 80 ? '…' : ''}</div>}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 13px 12px 13px', borderTop: '1px solid ' + T.cardBorder, paddingTop: 10 }} onClick={e => e.stopPropagation()}>
          {mention.sentiment_reason && (
            <div style={{ fontSize: 9, color: T.textMuted, background: T.pageBg, border: '1px solid ' + T.cardBorder, borderRadius: 5, padding: '5px 8px', marginBottom: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
              <i className="ti ti-sparkles" style={{ fontSize: 10, marginRight: 3 }} aria-hidden="true"></i>{mention.sentiment_reason}
            </div>
          )}
          {showReply && (
            <div style={{ fontSize: 11, color: '#5B21B6', background: T.purpleLight, borderRadius: 7, padding: '8px 11px', marginBottom: 8, border: '1px solid ' + T.purpleMid, lineHeight: 1.6 }}>
              <strong style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Suggested reply</strong>
              {mention.suggested_reply || 'No suggested reply available for this mention.'}
            </div>
          )}
          {showSavedReplies && savedReplies.length > 0 && (
            <div style={{ background: T.pageBg, borderRadius: 8, border: '1px solid ' + T.cardBorder, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, padding: '7px 11px', borderBottom: '1px solid ' + T.cardBorder, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved replies</div>
              {savedReplies.map(r => (
                <div key={r.id} style={{ padding: '8px 11px', borderBottom: '1px solid ' + T.cardBorder, cursor: 'pointer' }}
                  onClick={() => { mention.suggested_reply = r.content; setShowReply(true); setShowSavedReplies(false); }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>{r.content.slice(0, 80)}…</div>
                </div>
              ))}
            </div>
          )}
          {showSavedReplies && savedReplies.length === 0 && (
            <div style={{ background: T.pageBg, borderRadius: 8, border: '1px solid ' + T.cardBorder, marginBottom: 8, padding: '10px 12px', fontSize: 11, color: T.textMuted }}>
              No saved replies yet. Create them in the Inbox settings.
            </div>
          )}
          {aiAnswer && (
            <div style={{ fontSize: 11, color: T.purple, background: T.purpleSoft, borderRadius: 7, padding: '8px 11px', marginBottom: 8, border: '1px solid ' + T.purpleMid, lineHeight: 1.6 }}>
              <strong style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>AI Answer</strong>
              {aiAnswer}
            </div>
          )}
          {showAI && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }} onClick={e => e.stopPropagation()}>
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { e.stopPropagation(); if(e.key === 'Enter') askAI(); }} placeholder="Ask AI about this mention..."
                style={{ flex: 1, fontSize: 11, padding: '7px 11px', borderRadius: 7, border: '1px solid ' + T.cardBorder, background: T.pageBg, color: T.textPrimary, outline: 'none' }} />
              <button onClick={e => { e.stopPropagation(); askAI(); }} disabled={loadingAI} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 7, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontWeight: 600 }}>{loadingAI ? '…' : 'Ask'}</button>
            </div>
          )}
          {showMore && (
            <div style={{ background: T.pageBg, borderRadius: 9, padding: 12, marginBottom: 8, border: '1px solid ' + T.cardBorder, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 4 }}>Tags (comma separated)</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. urgent, billing, app"
                  style={{ width: '100%', fontSize: 11, padding: '6px 10px', borderRadius: 7, border: '1px solid ' + T.cardBorder, background: T.white, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 4 }}>Assign to</label>
                <input value={assignTo} onChange={e => setAssignTo(e.target.value)} placeholder="Team member email or name"
                  style={{ width: '100%', fontSize: 11, padding: '6px 10px', borderRadius: 7, border: '1px solid ' + T.cardBorder, background: T.white, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 4 }}>Internal note</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a private note visible only to your team..." rows={2}
                  style={{ width: '100%', fontSize: 11, padding: '6px 10px', borderRadius: 7, border: '1px solid ' + T.cardBorder, background: T.white, color: T.textPrimary, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <button onClick={saveMeta} disabled={savingMeta} style={{ alignSelf: 'flex-start', fontSize: 10, padding: '5px 14px', borderRadius: 7, border: 'none', background: metaSaved ? T.green : T.purple, color: T.white, cursor: 'pointer', fontWeight: 600 }}>
                {savingMeta ? 'Saving…' : metaSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          )}
          {!mention.is_resolved && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <ActionBtn label="Reply" icon="ti-message-reply" variant="primary" onClick={() => { setShowReply(r => !r); setShowSavedReplies(false); }} />
              <ActionBtn label="Saved replies" icon="ti-bookmark" variant="ghost" onClick={() => { setShowSavedReplies(r => !r); setShowReply(false); }} />
              {mention.url && <a href={mention.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, padding: '5px 11px', borderRadius: 7, background: T.purpleSoft, color: T.purple, border: '1px solid ' + T.purpleMid, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}><i className="ti ti-external-link" style={{ fontSize: 11 }} aria-hidden="true"></i>View</a>}
              <ActionBtn label="Resolve" icon="ti-check" variant="success" onClick={resolve} />
              <ActionBtn label="Ask AI" icon="ti-brain" variant="ghost" onClick={() => setShowAI(a => !a)} />
              <ActionBtn label="More" icon="ti-dots" variant="ghost" onClick={() => setShowMore(m => !m)} />
            </div>
          )}
          {mention.is_resolved && <div style={{ fontSize: 10, color: T.green, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}><i className="ti ti-circle-check" style={{ fontSize: 11 }} aria-hidden="true"></i>Resolved</div>}
        </div>
      )}
    </div>
  );
}


// ── Dashboard page ────────────────────────────────────────────────────────────
function DashboardPage({ business, stats, allMentions, onNavigate }) {
  const total = stats?.total || 0;
  const positive = stats?.positive || 0;
  const negative = stats?.negative || 0;
  const neutral = stats?.neutral || 0;
  const score = total > 0 ? Math.round(positive / total * 100) : 0;
  const now = new Date();
  const prev7 = allMentions.filter(m => { const age = now - new Date(m.fetched_at); return age >= 7 * 86400000 && age < 14 * 86400000; });
  const trendDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('en-CA');
    const dm = allMentions.filter(m => new Date(m.fetched_at).toLocaleDateString('en-CA') === ds);
    trendDays.push({ date: d.toLocaleDateString('en-CA', { weekday: 'short' })[0], pos: dm.filter(m => m.sentiment === 'positive').length, neg: dm.filter(m => m.sentiment === 'negative').length, neu: dm.filter(m => m.sentiment === 'neutral').length, total: dm.length });
  }
  const maxDay = Math.max(...trendDays.map(d => d.total), 1);
  const topicMap = {};
  allMentions.forEach(m => { if (m.topic) topicMap[m.topic] = (topicMap[m.topic] || 0) + 1; });
  const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const [mentionList, setMentionList] = React.useState([]);
  React.useEffect(() => { setMentionList([...allMentions].sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at)).slice(0, 8)); }, [allMentions]);
  const handleResolve = id => setMentionList(prev => prev.map(m => m.id === id ? { ...m, is_resolved: true } : m));
  const prevPositive = prev7.filter(m => m.sentiment === 'positive').length;
  const prevNegative = prev7.filter(m => m.sentiment === 'negative').length;
  const posChange = prev7.length > 0 ? Math.round((positive - prevPositive) / Math.max(prevPositive, 1) * 100) : null;
  const negChange = prev7.length > 0 ? Math.round((negative - prevNegative) / Math.max(prevNegative, 1) * 100) : null;
  const totalChange = prev7.length > 0 ? Math.round((total - prev7.length) / Math.max(prev7.length, 1) * 100) : null;

  return (
    <Page>
      <PageHead title="Brand health dashboard" subtitle={`${business?.name || ''} · Reddit · Google Reviews · Play Store`} />
      {stats?.spike && (
        <div style={{ background: T.redLight, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '11px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.white, fontSize: 15, flexShrink: 0 }}><i className="ti ti-alert-triangle" aria-hidden="true"></i></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Crisis alert: sentiment spike detected</div>
              <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 1 }}>{stats.spike_count} negative mentions in the last 2 hours</div>
            </div>
          </div>
          <button onClick={() => onNavigate('inbox')} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.redBorder}`, background: T.white, color: T.red, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>Review now</button>
        </div>
      )}
      {!stats?.spike && stats?.negative > 0 && (
        <div style={{ background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: '11px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.amber, fontSize: 15, flexShrink: 0 }}><i className="ti ti-alert-triangle" aria-hidden="true"></i></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Negative mentions need attention</div>
              <div style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>{stats.unresolved} unresolved mentions waiting for response</div>
            </div>
          </div>
          <button onClick={() => onNavigate('inbox')} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 7, border: `1px solid ${T.amberBorder}`, background: T.white, color: '#92400E', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>Review in inbox</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total mentions" value={total} icon="ti-messages" change={totalChange} />
        <MetricCard label="Positive" value={positive} color={T.green} icon="ti-thumb-up" change={posChange} />
        <MetricCard label="Negative" value={negative} color={T.red} icon="ti-thumb-down" change={negChange} onClick={() => onNavigate('inbox')} />
        <MetricCard label="Unresolved" value={stats?.unresolved || 0} color={T.amber} icon="ti-clock" />
        <MetricCard label="Sentiment score" value={score} suffix="/100" color={score >= 60 ? T.green : score >= 40 ? T.amber : T.red} dark icon="ti-chart-pie" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Conversation stream <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>({total})</span></div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Click to expand · sorted by most recent</div>
            </div>
            <button onClick={() => onNavigate('inbox')} style={{ fontSize: 10, color: T.purple, background: T.purpleSoft, border: `1px solid ${T.purpleMid}`, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>View all →</button>
          </div>
          {mentionList.length === 0
            ? <Card><div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted, fontSize: 13 }}><i className="ti ti-messages" style={{ fontSize: 32, display: 'block', marginBottom: 8, color: T.purpleMid }} aria-hidden="true"></i>No mentions yet. Scan runs every hour.</div></Card>
            : mentionList.map(m => <MentionCard key={m.id} mention={m} onResolve={handleResolve} />)
          }
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>Share of voice</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>Sentiment across all mentions</div>
            {[{ label: 'Positive', val: positive, color: T.green, pct: total ? Math.round(positive / total * 100) : 0 }, { label: 'Neutral', val: neutral, color: '#A78BFA', pct: total ? Math.round(neutral / total * 100) : 0 }, { label: 'Negative', val: negative, color: T.red, pct: total ? Math.round(negative / total * 100) : 0 }].map(row => (
              <div key={row.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block', flexShrink: 0 }}></span>
                    <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{row.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: row.color }}>{row.val}</span>
                    <span style={{ fontSize: 10, color: T.textHint }}>{row.pct}%</span>
                  </div>
                </div>
                <BarTrack pct={row.pct} color={row.color} />
              </div>
            ))}
          </Card>

          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>Mention trend</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>Last 7 days</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {trendDays.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 62, gap: 1 }}>
                    {day.pos > 0 && <div style={{ background: T.green, borderRadius: '2px 2px 0 0', height: `${(day.pos / maxDay) * 100}%`, minHeight: 3 }}></div>}
                    {day.neg > 0 && <div style={{ background: T.red, height: `${(day.neg / maxDay) * 100}%`, minHeight: 3 }}></div>}
                    {day.neu > 0 && <div style={{ background: '#A78BFA', height: `${(day.neu / maxDay) * 100}%`, minHeight: 3 }}></div>}
                    {day.total === 0 && <div style={{ background: T.purpleLight, borderRadius: 2, height: 3 }}></div>}
                  </div>
                  <div style={{ fontSize: 8, color: T.textHint, marginTop: 2 }}>{day.date}</div>
                  {day.total > 0 && <div style={{ fontSize: 8, color: T.textHint }}>{day.total}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              {[[T.green, 'Positive'], [T.red, 'Negative'], ['#A78BFA', 'Neutral']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}>
                  <div style={{ width: 7, height: 7, borderRadius: 1, background: c }}></div>{l}
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'This week', val: allMentions.filter(m => (now - new Date(m.fetched_at)) < 7 * 86400000).length, color: T.purple, sub: 'Prev: ' + prev7.length },
                { label: 'Positive rate', val: score + '%', color: score >= 60 ? T.green : T.red, sub: 'Target: 60%' },
                { label: 'Unresolved', val: stats?.unresolved || 0, color: T.amber, sub: 'Need response' },
                { label: 'Sources', val: [...new Set(allMentions.map(m => m.source))].length, color: T.blue, sub: 'Active channels' }
              ].map(item => (
                <div key={item.label} style={{ background: T.pageBg, borderRadius: 9, padding: '12px 13px', border: '1px solid ' + T.cardBorder }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color, lineHeight: 1, marginBottom: 4 }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: T.textHint }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>Top topics</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>What customers talk about most</div>
            {topTopics.length === 0
              ? <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>
                  <i className="ti ti-tag" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: T.purpleMid }} aria-hidden="true"></i>
                  Topic data will appear as mentions are scanned
                </div>
              : topTopics.map(([topic, count], i) => (
                <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: T.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: T.purple, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600, textTransform: 'capitalize' }}>{topic}</span>
                      <span style={{ fontSize: 11, color: T.purple, fontWeight: 800 }}>{count}</span>
                    </div>
                    <BarTrack pct={(count / topTopics[0][1]) * 100} color={T.purple} />
                  </div>
                </div>
              ))
            }
          </Card>

        </div>
      </div>
    </Page>
  );
}

// ── Inbox page ────────────────────────────────────────────────────────────────
function InboxPage({ business, mentions, setMentions, filter, setFilter, loading, onRefresh, mentionLimit, setMentionLimit }) {
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [savedReplies, setSavedReplies] = React.useState([]);
  const [resolvedFilter, setResolvedFilter] = React.useState('unresolved');
  React.useEffect(() => {
    if (business?.id) {
      api.get(`/businesses/${business.id}/saved-replies`).then(r => setSavedReplies(r.data || [])).catch(() => {});
    }
  }, [business?.id]);
  const handleResolve = id => setMentions(prev => prev.map(m => m.id === id ? { ...m, is_resolved: true } : m));
  const srcMap = { reddit: 'Reddit', google: 'Google Reviews', playstore: 'Play Store', appstore: 'App Store' };
  const filtered = mentions.filter(m => {
    if (sourceFilter !== 'all' && m.source !== srcMap[sourceFilter]) return false;
    if (search && !m.content?.toLowerCase().includes(search.toLowerCase()) && !m.author?.toLowerCase().includes(search.toLowerCase())) return false;
    if (resolvedFilter === 'unresolved' && m.is_resolved) return false;
    if (resolvedFilter === 'resolved' && !m.is_resolved) return false;
    return true;
  });
  const resolved = mentions.filter(m => m.is_resolved).length;
  const unresolved = mentions.filter(m => !m.is_resolved).length;
  const FilterBtn = ({ val, label, active, onClick }) => (
    <button onClick={onClick} style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: active ? 'none' : `1px solid ${T.cardBorder}`, background: active ? T.purple : T.white, color: active ? T.white : T.gray500, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.12s' }}>{label}</button>
  );
  return (
    <Page>
      <PageHead title="Mention inbox" subtitle={`${mentions.length} mentions · ${unresolved} unresolved · ${resolved} resolved`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[{ label: 'Total', val: mentions.length, color: T.purple }, { label: 'Unresolved', val: unresolved, color: T.red }, { label: 'Resolved', val: resolved, color: T.green }].map(s => (
          <Card key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Status:</span>
          {['all', 'unresolved', 'resolved'].map(f => <FilterBtn key={f} val={f} label={f.charAt(0).toUpperCase()+f.slice(1)} active={resolvedFilter === f} onClick={() => setResolvedFilter(f)} />)}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Sentiment:</span>
            {['all', 'positive', 'negative', 'neutral'].map(f => <FilterBtn key={f} val={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onClick={() => setFilter(f)} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Source:</span>
            {[['all', 'All'], ['reddit', 'Reddit'], ['google', 'Google'], ['playstore', 'Play Store']].map(([v, l]) => <FilterBtn key={v} val={v} label={l} active={sourceFilter === v} onClick={() => setSourceFilter(v)} />)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by keyword or author..." style={{ flex: 1, minWidth: 200, fontSize: 11, padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.pageBg, color: T.textPrimary, outline: 'none' }} />
          <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Show:</span>
          {[100, 200, 500, 'All'].map(n => {
            const val = n === 'All' ? 10000 : n;
            return <button key={n} onClick={() => setMentionLimit(val)} style={{ fontSize: 10, padding: '4px 9px', borderRadius: 6, border: `1px solid ${mentionLimit === val ? T.purple : T.cardBorder}`, background: mentionLimit === val ? T.purpleLight : T.white, color: mentionLimit === val ? T.purple : T.gray500, cursor: 'pointer', fontWeight: mentionLimit === val ? 700 : 400 }}>{n}</button>;
          })}
          <button onClick={onRefresh} style={{ fontSize: 10, padding: '5px 11px', borderRadius: 7, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.gray600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-refresh" style={{ fontSize: 11 }} aria-hidden="true"></i>Refresh
          </button>
        </div>
      </Card>
      {loading
        ? <Card><div style={{ textAlign: 'center', color: T.textMuted, padding: '48px', fontSize: 13 }}>Loading mentions…</div></Card>
        : filtered.length === 0
          ? <Card><div style={{ textAlign: 'center', padding: '48px' }}><i className="ti ti-inbox" style={{ fontSize: 36, display: 'block', marginBottom: 12, color: T.purpleMid }} aria-hidden="true"></i><div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, marginBottom: 6 }}>No mentions found</div><div style={{ fontSize: 12, color: T.textMuted }}>Try changing the filters or refreshing.</div></div></Card>
          : filtered.map(m => <MentionCard key={m.id} mention={{ ...m, business_id: business?.id }} onResolve={handleResolve} businessId={business?.id} savedReplies={savedReplies} />)
      }
    </Page>
  );
}

// ── Analytics page ────────────────────────────────────────────────────────────
function AnalyticsPage({ business, allMentions }) {
  const [chanFilter, setChanFilter] = React.useState('all');
  const filtered = chanFilter === 'all' ? allMentions : allMentions.filter(m => m.source === (chanFilter === 'reddit' ? 'Reddit' : chanFilter === 'google' ? 'Google Reviews' : 'Play Store'));
  const total = filtered.length;
  const positive = filtered.filter(m => m.sentiment === 'positive').length;
  const negative = filtered.filter(m => m.sentiment === 'negative').length;
  const neutral = filtered.filter(m => m.sentiment === 'neutral').length;
  const score = total ? Math.round(positive / total * 100) : 0;
  const reddit = allMentions.filter(m => m.source === 'Reddit').length;
  const google = allMentions.filter(m => m.source === 'Google Reviews').length;
  const playstore = allMentions.filter(m => m.source === 'Play Store').length;
  const langMap = {};
  filtered.forEach(m => { if (m.language) langMap[m.language] = (langMap[m.language] || 0) + 1; });
  const langNames = { en: 'English', fr: 'French', uk: 'Ukrainian', ur: 'Urdu', pa: 'Punjabi', ar: 'Arabic', hi: 'Hindi', es: 'Spanish' };
  const langEntries = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const trendDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('en-CA');
    const dm = filtered.filter(m => new Date(m.fetched_at).toLocaleDateString('en-CA') === ds);
    trendDays.push({ date: d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), pos: dm.filter(m => m.sentiment === 'positive').length, neg: dm.filter(m => m.sentiment === 'negative').length, neu: dm.filter(m => m.sentiment === 'neutral').length, total: dm.length });
  }
  const maxDay = Math.max(...trendDays.map(d => d.total), 1);
  const hourCounts = Array(24).fill(0);
  allMentions.forEach(m => { const h = new Date(m.fetched_at).getHours(); hourCounts[h]++; });
  const maxHour = Math.max(...hourCounts, 1);
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const wordCounts = {};
  filtered.forEach(m => {
    if (!m.content) return;
    m.content.toLowerCase().split(/\s+/).forEach(w => {
      w = w.replace(/[^a-z]/g, '');
      if (w.length > 4 && !['their', 'there', 'which', 'about', 'would', 'could', 'should', 'these', 'those', 'after', 'before', 'other', 'every', 'first', 'never', 'where', 'while', 'being', 'https'].includes(w))
        wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const subMap = {};
  filtered.forEach(m => { if (m.subreddit) subMap[m.subreddit] = (subMap[m.subreddit] || 0) + 1; });
  const topSubs = Object.entries(subMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topicMap = {};
  filtered.forEach(m => { if (m.topic) topicMap[m.topic] = (topicMap[m.topic] || 0) + 1; });
  const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const now = new Date();
  const last7 = filtered.filter(m => (now - new Date(m.fetched_at)) < 7 * 86400000);
  const prev7 = filtered.filter(m => { const age = now - new Date(m.fetched_at); return age >= 7 * 86400000 && age < 14 * 86400000; });
  const last7Score = last7.length ? Math.round(last7.filter(m => m.sentiment === 'positive').length / last7.length * 100) : 0;
  const prev7Score = prev7.length ? Math.round(prev7.filter(m => m.sentiment === 'positive').length / prev7.length * 100) : 0;
  const scoreDelta = last7Score - prev7Score;

  return (
    <Page>
      <PageHead title="Analytics" subtitle={`Full breakdown for ${business?.name}`} />
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginRight: 4 }}>Channel:</span>
        {[['all', 'All channels'], ['reddit', 'Reddit'], ['google', 'Google Reviews'], ['playstore', 'Play Store']].map(([v, l]) => (
          <button key={v} onClick={() => setChanFilter(v)} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 20, border: `1px solid ${chanFilter === v ? T.purple : T.cardBorder}`, background: chanFilter === v ? T.purple : T.white, color: chanFilter === v ? T.white : T.gray600, cursor: 'pointer', fontWeight: chanFilter === v ? 600 : 400, transition: 'all 0.12s' }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <MetricCard label="Total mentions" value={total} icon="ti-messages" change={prev7.length > 0 ? Math.round((total - prev7.length) / Math.max(prev7.length, 1) * 100) : null} />
        <MetricCard label="Positive" value={positive} color={T.green} icon="ti-thumb-up" change={prev7.length > 0 ? Math.round((positive - prev7.filter(m => m.sentiment === 'positive').length) / Math.max(prev7.filter(m => m.sentiment === 'positive').length, 1) * 100) : null} />
        <MetricCard label="Negative" value={negative} color={T.red} icon="ti-thumb-down" />
        <div style={{ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)', borderRadius: 11, padding: 16, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Sentiment score</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.white, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 5 }}>{score}<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>/100</span></div>
          {scoreDelta !== 0 && <Badge label={`${Math.abs(scoreDelta)} pts vs prev week`} up={scoreDelta > 0} />}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card>
          <CardTitle>Mention volume</CardTitle>
          <CardSub>Last 7 days by sentiment</CardSub>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90 }}>
            {trendDays.map((day, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {day.total > 0 && <div style={{ fontSize: 8, color: T.textHint, marginBottom: 2 }}>{day.total}</div>}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 66, gap: 1 }}>
                  {day.pos > 0 && <div style={{ background: T.green, borderRadius: '2px 2px 0 0', height: `${(day.pos / maxDay) * 100}%`, minHeight: 3 }}></div>}
                  {day.neg > 0 && <div style={{ background: T.red, height: `${(day.neg / maxDay) * 100}%`, minHeight: 3 }}></div>}
                  {day.neu > 0 && <div style={{ background: '#A78BFA', height: `${(day.neu / maxDay) * 100}%`, minHeight: 3 }}></div>}
                  {day.total === 0 && <div style={{ background: T.purpleLight, borderRadius: 2, height: 4 }}></div>}
                </div>
                <div style={{ fontSize: 8, color: T.textHint }}>{day.date}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            {[[T.green, 'Positive'], [T.red, 'Negative'], ['#A78BFA', 'Neutral']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}><div style={{ width: 7, height: 7, borderRadius: 1, background: c }}></div>{l}</div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Sentiment breakdown</CardTitle>
          <CardSub>Distribution across all mentions</CardSub>
          {[['Positive', positive, T.green], ['Neutral', neutral, '#A78BFA'], ['Negative', negative, T.red]].map(([label, val, color]) => (
            <div key={label} style={{ marginBottom: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                  <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{label}</span>
                </div>
                <div><span style={{ fontSize: 13, fontWeight: 800, color }}>{val.toLocaleString()}</span> <span style={{ fontSize: 10, color: T.textHint }}>({total ? Math.round(val / total * 100) : 0}%)</span></div>
              </div>
              <BarTrack pct={total ? (val / total * 100) : 0} color={color} />
            </div>
          ))}

        </Card>
        <Card>
          <CardTitle>Activity by hour</CardTitle>
          <div style={{ fontSize: 11, color: T.purple, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="ti ti-clock" style={{ fontSize: 12 }} aria-hidden="true"></i>Peak: {peakHour}:00 · {hourCounts[peakHour]} mentions
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 66 }}>
            {hourCounts.map((count, h) => (
              <div key={h} title={`${h}:00 — ${count}`} style={{ flex: 1, height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? 3 : 1, background: h === peakHour ? T.purple : count > 0 ? '#A78BFA' : T.purpleLight, borderRadius: '2px 2px 0 0', opacity: count > 0 ? 1 : 0.4, transition: 'height 0.3s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {['12AM', '6AM', '12PM', '6PM', '11PM'].map(t => <span key={t} style={{ fontSize: 9, color: T.textHint }}>{t}</span>)}
          </div>
        </Card>
        <Card>
          <CardTitle>Language breakdown</CardTitle>
          <CardSub>What languages your community speaks</CardSub>
          {langEntries.length === 0
            ? <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>No language data yet</div>
            : langEntries.map(([lang, count]) => (
              <div key={lang} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{langNames[lang] || lang.toUpperCase()}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.purple }}>{count} <span style={{ color: T.textHint, fontWeight: 400, fontSize: 10 }}>({total ? Math.round(count / total * 100) : 0}%)</span></span>
                </div>
                <BarTrack pct={total ? (count / total * 100) : 0} color={T.purple} />
              </div>
            ))
          }
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card>
          <CardTitle>Top keywords</CardTitle>
          <CardSub>Most mentioned words</CardSub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topKeywords.map(([word, count], i) => (
              <div key={word} style={{ fontSize: i < 3 ? 12 : i < 6 ? 11 : 10, fontWeight: i < 3 ? 700 : i < 6 ? 500 : 400, padding: '4px 10px', borderRadius: 20, background: i < 3 ? T.purple : i < 6 ? T.purpleLight : T.pageBg, color: i < 3 ? T.white : i < 6 ? '#5B21B6' : T.textMuted, border: `1px solid ${T.cardBorder}` }}>
                {word} <span style={{ opacity: 0.5, fontSize: 9 }}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Top subreddits</CardTitle>
          <CardSub>Reddit communities discussing your brand</CardSub>
          {topSubs.length === 0
            ? <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>No subreddit data yet</div>
            : topSubs.map(([sub, count]) => {
              const color = getSubredditColor(sub);
              return (
                <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color, flexShrink: 0 }}>r/</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: T.textSecondary }}>r/{sub}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color }}>{count}</span>
                    </div>
                    <BarTrack pct={(count / topSubs[0][1]) * 100} color={color} />
                  </div>
                </div>
              );
            })
          }
        </Card>
        {topTopics.length > 0 && (
          <Card>
            <CardTitle>Topic breakdown</CardTitle>
            <CardSub>What customers talk about most</CardSub>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {topTopics.slice(0, 6).map(([topic, count]) => (
                <div key={topic} style={{ background: T.pageBg, borderRadius: 8, padding: '9px 10px', border: `1px solid ${T.cardBorder}` }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>{topic}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.purple, lineHeight: 1, marginBottom: 3 }}>{count}</div>
                  <BarTrack pct={(count / topTopics[0][1]) * 100} color={T.purple} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Page>
  );
}

// ── My Business page ──────────────────────────────────────────────────────────
function MyBusinessPage({ business, onSaved }) {
  const [name, setName] = useState(business?.name || '');
  const [keywords, setKeywords] = useState(business?.keywords || '');
  const [alertEmail, setAlertEmail] = useState(business?.alert_email || '');
  const [appstoreId, setAppstoreId] = useState(business?.appstore_id || '');
  const [playstoreId, setPlaystoreId] = useState(business?.playstore_id || '');
  const [trustpilotDomain, setTrustpilotDomain] = useState(business?.trustpilot_domain || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [kwStep, setKwStep] = useState(0);
  const [kwInput, setKwInput] = useState('');
  const [kwLoading, setKwLoading] = useState(false);
  const [kwAnswers, setKwAnswers] = useState({});
  const kwQuestions = [
    { key: 'informal', q: 'What do customers informally call your business? (nicknames, short forms, misspellings)' },
    { key: 'region', q: 'What region or city are you in? (e.g. Toronto, Ontario, Canada)' },
  ];
  const startKw = () => { setKwStep(1); setKwAnswers({ name: name || business?.name || '' }); setKwInput(''); };
  const nextKw = async () => {
    const q = kwQuestions[kwStep - 1];
    const updated = { ...kwAnswers, [q.key]: kwInput };
    setKwAnswers(updated); setKwInput('');
    if (kwStep < kwQuestions.length) { setKwStep(s => s + 1); return; }
    setKwLoading(true);
    try {
      const r = await api.post('/suggest-keywords', { mode: 'business', answers: updated });
      setKeywords(r.data.keywords); setKwStep(0);
      await api.patch(`/businesses/${business.id}`, { keywords: r.data.keywords }).catch(() => {});
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { setKwStep(0); }
    setKwLoading(false);
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/businesses/${business.id}`, { name, keywords, alert_email: alertEmail, appstore_id: appstoreId, playstore_id: playstoreId, trustpilot_domain: trustpilotDomain });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${T.cardBorder}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: T.pageBg, color: T.textPrimary };
  const sources = [
    { name: 'Reddit', status: business?.reddit_enabled !== false ? 'connected' : 'disabled', icon: 'ti-brand-reddit', color: '#FF4500', desc: business?.reddit_enabled !== false ? 'RSS feed · hourly' : 'Disabled', field: 'reddit_enabled' },
    { name: 'Google Reviews', status: business?.google_enabled !== false ? 'connected' : 'disabled', icon: 'ti-brand-google', color: '#4285F4', desc: business?.google_enabled !== false ? 'SerpApi · hourly' : 'Disabled', field: 'google_enabled' },
    { name: 'Play Store', status: business?.playstore_id ? 'connected' : 'not_set', icon: 'ti-brand-google-play', color: '#01875F', desc: business?.playstore_id ? `ID: ${business.playstore_id}` : 'Add Play Store ID', field: null },
    { name: 'App Store', status: business?.appstore_id ? 'connected' : 'not_set', icon: 'ti-brand-apple', color: '#000', desc: business?.appstore_id ? `ID: ${business.appstore_id}` : 'Add App Store ID', field: null },
    { name: 'Trustpilot', status: business?.trustpilot_domain ? 'connected' : 'not_set', icon: 'ti-star', color: '#00B67A', desc: business?.trustpilot_domain || 'Add domain', field: null },
    { name: 'Instagram', status: 'soon', icon: 'ti-brand-instagram', color: '#E1306C', desc: 'V2', field: null },
    { name: 'Twitter / X', status: 'soon', icon: 'ti-brand-x', color: '#000', desc: 'V2', field: null },
  ];
  return (
    <Page>
      <PageHead title="My business" subtitle="Manage your business profile and monitoring settings" />
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 18 }}>Business details</div>
        {[
          { label: 'Business name', val: name, setter: setName, type: 'text', hint: '' },
          { label: 'Alert email', val: alertEmail, setter: setAlertEmail, type: 'email', hint: '' },
          { label: 'App Store ID', val: appstoreId, setter: setAppstoreId, type: 'text', hint: 'e.g. 123456789' },
          { label: 'Play Store ID', val: playstoreId, setter: setPlaystoreId, type: 'text', hint: 'e.g. com.yourcompany.app' },
          { label: 'Trustpilot domain', val: trustpilotDomain, setter: setTrustpilotDomain, type: 'text', hint: 'e.g. yourcompany.com' },
        ].map(({ label, val, setter, type, hint }) => (
          <div key={label} style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>{label}</label>
            <input value={val} onChange={e => setter(e.target.value)} type={type} style={inputStyle} />
            {hint && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{hint}</div>}
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>Keywords to monitor</label>
          <textarea value={keywords} onChange={e => setKeywords(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>Comma separated. Searched hourly across Reddit and Google.</div>
          <button onClick={startKw} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${T.purpleMid}`, background: T.purpleSoft, color: T.purple, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <i className="ti ti-sparkles" style={{ fontSize: 12 }} aria-hidden="true"></i>AI suggest keywords
          </button>
          {kwStep > 0 && (
            <div style={{ background: T.purpleSoft, border: `1px solid ${T.purpleMid}`, borderRadius: 10, padding: '14px 16px', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.purple }}>AI Keyword Suggester</span>
                <span style={{ fontSize: 11, color: T.textHint, marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setKwStep(0)}>✕</span>
              </div>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 10 }}>{kwQuestions[kwStep - 1]?.q}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && kwInput.trim() && nextKw()} placeholder="Type your answer..." style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: `1px solid ${T.purpleMid}`, fontSize: 12, outline: 'none', color: T.textPrimary }} />
                <button onClick={nextKw} disabled={!kwInput.trim() || kwLoading} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: T.purple, color: T.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: kwLoading ? 0.6 : 1 }}>
                  {kwLoading ? 'Generating…' : kwStep < kwQuestions.length ? 'Next →' : 'Generate'}
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: saved ? '#16A34A' : T.purple, color: T.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Connected data sources</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>Platforms Senti monitors for your business</div>
        {sources.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: s.color }}>
                <i className={`ti ${s.icon}`} aria-hidden="true"></i>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{s.desc}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {s.field && (
                <div onClick={async () => { try { await api.patch(`/businesses/${business.id}`, { [s.field]: s.status === 'disabled' }); window.location.reload(); } catch {} }}
                  style={{ width: 36, height: 20, borderRadius: 10, background: s.status === 'connected' ? T.purple : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: s.status === 'connected' ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                </div>
              )}
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.status === 'connected' ? T.greenLight : s.status === 'disabled' ? T.redLight : T.pageBg, color: s.status === 'connected' ? T.green : s.status === 'disabled' ? T.red : T.textMuted }}>
                {s.status === 'connected' ? 'Connected' : s.status === 'disabled' ? 'Disabled' : s.status === 'soon' ? 'Coming soon' : 'Not set'}
              </span>
            </div>
          </div>
        ))}
      </Card>
    </Page>
  );
}

// ── AI Analyst page ───────────────────────────────────────────────────────────
function AIAnalystPage({ business }) {
  const [messages, setMessages] = React.useState([{ role: 'assistant', content: `Hi! I am your AI Brand Analyst for ${business?.name || 'your business'}. I have analyzed all your mentions and I am ready to answer questions about your brand health, reputation risks, customer sentiment and more. What would you like to know?` }]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef(null);
  const suggested = ['What are customers complaining about most?', 'What is my biggest reputation risk?', 'Which channel has the most negative feedback?', 'What do customers love about us?', 'Are there any crisis signals I should know about?'];
  const ask = async (q) => {
    const question = (q || input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await api.post(`/businesses/${business.id}/ai-analyst`, { question, history: messages.map(m => ({ role: m.role, content: m.content })) });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, could not connect to the AI. Please try again.' }]); }
    setLoading(false);
  };
  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  return (
    <Page>
      <PageHead title="AI Analyst" subtitle={`Powered by Groq Llama 3.3 · Analyzing ${business?.name}`} />
      <div style={{ display: 'flex', flexDirection: 'column', background: T.white, borderRadius: 12, border: `1px solid ${T.cardBorder}`, overflow: 'hidden', height: 'calc(100vh - 160px)' }}>
        <div style={{ background: T.purple, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.white }}>
            <i className="ti ti-sparkles" aria-hidden="true"></i>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Senti AI Analyst</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Groq Llama 3.3 70B · Real mention data</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && <div style={{ width: 30, height: 30, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: T.white }}><i className="ti ti-sparkles" aria-hidden="true"></i></div>}
              <div style={{ maxWidth: '75%', padding: '11px 15px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? T.purple : T.pageBg, color: m.role === 'user' ? T.white : T.textPrimary, fontSize: 13, lineHeight: 1.7, border: m.role === 'assistant' ? `1px solid ${T.cardBorder}` : 'none' }}>{m.content}</div>
              {m.role === 'user' && <div style={{ width: 30, height: 30, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.white, flexShrink: 0 }}>You</div>}
            </div>
          ))}
          {loading && <div style={{ display: 'flex', gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: T.white }}><i className="ti ti-sparkles" aria-hidden="true"></i></div><div style={{ padding: '11px 15px', borderRadius: '18px 18px 18px 4px', background: T.pageBg, color: T.textMuted, fontSize: 13, border: `1px solid ${T.cardBorder}` }}>Thinking…</div></div>}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 2 && (
          <div style={{ padding: '0 18px 12px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {suggested.map((q, i) => <button key={i} onClick={() => ask(q)} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 20, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>{q}</button>)}
          </div>
        )}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask anything about your brand health…" style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.cardBorder}`, fontSize: 13, outline: 'none', background: T.pageBg, color: T.textPrimary }} />
          <button onClick={() => ask()} disabled={loading || !input.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: T.purple, color: T.white, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </Page>
  );
}

// ── AI Agent page ─────────────────────────────────────────────────────────────
function AIAgentPage({ business }) {
  const [settings, setSettings] = React.useState({ enabled: false, auto_resolve: false, auto_escalate: false, auto_draft: false, escalate_threshold: 0.3 });
  const [actions, setActions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    if (!business?.id) return;
    api.get(`/businesses/${business.id}/agent`).then(r => {
      setSettings({ enabled: r.data.enabled, auto_resolve: r.data.auto_resolve, auto_escalate: r.data.auto_escalate, auto_draft: r.data.auto_draft, escalate_threshold: r.data.escalate_threshold });
      setActions(r.data.actions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [business?.id]);
  const save = async () => {
    setSaving(true);
    await api.patch(`/businesses/${business.id}/agent`, settings).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };
  const toggle = key => setSettings(s => ({ ...s, [key]: !s[key] }));
  const Toggle = ({ value, onChange, disabled }) => (
    <div onClick={!disabled ? onChange : undefined} style={{ width: 40, height: 22, borderRadius: 11, background: value ? T.purple : T.gray200, cursor: disabled ? 'default' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
    </div>
  );
  const agentCards = [
    { key: 'auto_resolve', icon: 'ti-circle-check', bg: T.greenLight, color: T.green, title: 'Auto-resolve', desc: 'Automatically resolves positive mentions so your inbox stays clean.' },
    { key: 'auto_escalate', icon: 'ti-alert-triangle', bg: T.redLight, color: T.red, title: 'Auto-escalate', desc: 'Emails you and flags urgent negative mentions immediately.' },
    { key: 'auto_draft', icon: 'ti-sparkles', bg: T.purpleLight, color: T.purple, title: 'Auto-draft replies', desc: 'AI drafts a reply for every new negative mention for your review.' },
  ];
  const actionColor = t => t === 'auto_resolved' ? T.green : t === 'auto_escalated' ? T.red : T.purple;
  const actionBg = t => t === 'auto_resolved' ? T.greenLight : t === 'auto_escalated' ? T.redLight : T.purpleLight;
  if (loading) return <Page><div style={{ textAlign: 'center', padding: 60, color: T.textMuted }}>Loading…</div></Page>;
  return (
    <Page>
      <PageHead title="AI Agent" subtitle="Automate how Senti handles your mentions" />
      <Card style={{ marginBottom: 14, background: settings.enabled ? T.purpleSoft : T.white, border: `2px solid ${settings.enabled ? T.purple : T.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: settings.enabled ? T.purple : T.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: settings.enabled ? T.white : T.purple, transition: 'all 0.2s' }}>
            <i className="ti ti-robot" aria-hidden="true"></i>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              AI Agent
              {settings.enabled && <span style={{ fontSize: 10, background: T.purple, color: T.white, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Active</span>}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Runs every hour alongside your data scan</div>
          </div>
        </div>
        <Toggle value={settings.enabled} onChange={() => toggle('enabled')} />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {agentCards.map(card => (
          <Card key={card.key} style={{ opacity: settings.enabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: card.color }}>
                <i className={`ti ${card.icon}`} aria-hidden="true"></i>
              </div>
              <Toggle value={settings[card.key]} onChange={() => toggle(card.key)} disabled={!settings.enabled} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>{card.desc}</div>
            {card.key === 'auto_escalate' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>Threshold:</span>
                <input type="number" min="0.1" max="0.5" step="0.05" value={settings.escalate_threshold} onChange={e => setSettings(s => ({ ...s, escalate_threshold: parseFloat(e.target.value) }))} style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', color: T.textPrimary }} />
              </div>
            )}
          </Card>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: saved ? T.green : T.purple, color: T.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14, transition: 'background 0.2s' }}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
      </button>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Agent activity log</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>Actions taken by the AI Agent</div>
        {actions.length === 0
          ? <div style={{ textAlign: 'center', padding: '28px 0', color: T.textMuted, fontSize: 13 }}><i className="ti ti-robot" style={{ fontSize: 28, display: 'block', marginBottom: 8, color: T.purpleMid }} aria-hidden="true"></i>No agent actions yet. Enable the agent to start.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {actions.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', background: T.pageBg, borderRadius: 8, border: `1px solid ${T.cardBorder}` }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: actionBg(a.action_type), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: actionColor(a.action_type), flexShrink: 0, fontWeight: 700 }}>
                  <i className={`ti ${a.action_type === 'auto_resolved' ? 'ti-check' : a.action_type === 'auto_escalated' ? 'ti-alert-triangle' : 'ti-sparkles'}`} aria-hidden="true"></i>
                </div>
                <span style={{ fontSize: 12, color: T.textPrimary, flex: 1 }}>{a.detail}</span>
                <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{a.created_at}</span>
              </div>
            ))}
          </div>
        }
      </Card>
    </Page>
  );
}

// ── Competitor page ───────────────────────────────────────────────────────────
function CompetitorPage({ business }) {
  const [competitors, setCompetitors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newKeywords, setNewKeywords] = React.useState('');
  const [error, setError] = React.useState('');
  const [myScore, setMyScore] = React.useState(0);
  const [ckStep, setCkStep] = React.useState(0);
  const [ckInput, setCkInput] = React.useState('');
  const [ckLoading, setCkLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([api.get(`/businesses/${business.id}/competitors`), api.get(`/businesses/${business.id}/stats`)]);
      setCompetitors(r.data);
      if (s.data?.total > 0) setMyScore(Math.round(s.data.positive / s.data.total * 100));
    } catch { setError('Failed to load'); }
    setLoading(false);
  };
  React.useEffect(() => { if (business?.id) load(); }, [business?.id]);

  const add = async () => {
    if (!newName.trim() || !newKeywords.trim()) return;
    setAdding(true); setError('');
    try {
      const r = await api.post(`/businesses/${business.id}/competitors`, { name: newName.trim(), keywords: newKeywords.trim() });
      setCompetitors(prev => [...prev, r.data]); setNewName(''); setNewKeywords('');
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add'); }
    setAdding(false);
  };

  const del = async (id) => {
    try { await api.delete(`/businesses/${business.id}/competitors/${id}`); setCompetitors(prev => prev.filter(c => c.id !== id)); } catch {}
  };

  const scan = async (id) => {
    setScanning(id);
    try { await api.post(`/businesses/${business.id}/competitors/${id}/scan`, {}); await load(); } catch { setError('Scan failed'); }
    setScanning(null);
  };

  const runCkSuggest = async () => {
    setCkLoading(true);
    try {
      const r = await api.post('/suggest-keywords', { mode: 'competitor', answers: { name: newName, region: ckInput || 'Canada' } });
      setNewKeywords(r.data.keywords); setCkStep(0);
    } catch { setCkStep(0); }
    setCkLoading(false);
  };

  const scoreColor = s => s >= 60 ? T.green : s >= 40 ? T.amber : T.red;
  const scoreBg = s => s >= 60 ? T.greenLight : s >= 40 ? T.amberLight : T.redLight;
  const sentColor = s => s === 'positive' ? T.green : s === 'negative' ? T.red : T.textMuted;

  const allBrands = [
    { name: business?.name || 'You', score: myScore, isYou: true },
    ...competitors.filter(c => c.total > 0).map(c => ({ name: c.name, score: c.score, isYou: false }))
  ];
  const maxScore = Math.max(...allBrands.map(b => b.score), 1);

  return (
    <Page>
      <PageHead title="Competitor tracking" subtitle={"Compare " + (business?.name || '') + " against rivals"} />
      {error && <div style={{ background: T.redLight, border: "1px solid " + T.redBorder, borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {ckStep > 0 && (
        <Card style={{ marginBottom: 14, background: T.purpleSoft, border: "1px solid " + T.purpleMid }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.purple }}>AI Keyword Suggester for {newName}</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setCkStep(0)}>✕</span>
          </div>
          <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 10 }}>What region are you targeting? (e.g. Canada, Ontario)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ckInput} onChange={e => setCkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && runCkSuggest()} placeholder="e.g. Canada" style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: "1px solid " + T.purpleMid, fontSize: 12, outline: 'none', color: T.textPrimary }} />
            <button onClick={runCkSuggest} disabled={ckLoading} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: T.purple, color: T.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: ckLoading ? 0.6 : 1 }}>{ckLoading ? 'Generating…' : 'Generate'}</button>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>Add competitor</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>Track up to 5 competitors.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Competitor name (e.g. McDonald's)" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: "1px solid " + T.cardBorder, fontSize: 12, outline: 'none', color: T.textPrimary, background: T.pageBg, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="Keywords (e.g. mcdonald's, mcdonalds, mcd)" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: "1px solid " + T.cardBorder, fontSize: 12, outline: 'none', color: T.textPrimary, background: T.pageBg, boxSizing: 'border-box' }} />
              <button onClick={() => { if (!newName.trim()) { setError('Enter competitor name first'); return; } setCkStep(1); setCkInput(''); }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 6, border: "1px solid " + T.purpleMid, background: T.purpleSoft, color: T.purple, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                <i className="ti ti-sparkles" style={{ fontSize: 11 }} aria-hidden="true"></i>AI suggest keywords
              </button>
            </div>
            <button onClick={add} disabled={adding || !newName.trim() || !newKeywords.trim()} style={{ padding: '10px', borderRadius: 8, border: 'none', background: T.purple, color: T.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: adding ? 0.6 : 1 }}>{adding ? 'Adding…' : '+ Add competitor'}</button>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>Score comparison</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>Sentiment score out of 100</div>
          {allBrands.length === 1 && !loading && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 12 }}>
              <i className="ti ti-trophy" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: T.purpleMid }} aria-hidden="true"></i>
              Add competitors to see how you compare
            </div>
          )}
          {allBrands.map((brand, i) => (
            <div key={brand.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: brand.isYou ? T.purple : T.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: brand.isYou ? T.white : T.purple, flexShrink: 0 }}>{brand.name.charAt(0)}</div>
                  <span style={{ fontSize: 12, fontWeight: brand.isYou ? 700 : 500, color: T.textPrimary }}>{brand.name}{brand.isYou && <span style={{ fontSize: 9, background: T.purple, color: T.white, padding: '1px 6px', borderRadius: 8, marginLeft: 6, fontWeight: 600 }}>You</span>}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor(brand.score) }}>{brand.score}<span style={{ fontSize: 10, color: T.textMuted, fontWeight: 400 }}>/100</span></span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: T.pageBg, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: brand.isYou ? T.purple : scoreColor(brand.score), width: (brand.score) + '%', transition: 'width 0.6s ease' }}></div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {competitors.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '36px', fontSize: 13, color: T.textMuted }}>
                <i className="ti ti-trophy" style={{ fontSize: 32, display: 'block', marginBottom: 10, color: T.purpleMid }} aria-hidden="true"></i>
                <div style={{ fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>No competitors yet</div>
                Add a competitor above to start tracking their sentiment.
              </div>
            </Card>
          ) : competitors.map(comp => (
            <Card key={comp.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: T.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: T.purple, flexShrink: 0 }}>{comp.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>{comp.name}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>Keywords: {comp.keywords}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {comp.total > 0 ? (
                    <>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(comp.score) }}>{comp.score}</div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary }}>{comp.total}</div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mentions</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{comp.positive}</div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Positive</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: T.red }}>{comp.negative}</div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Negative</div>
                        </div>
                      </div>
                      <div style={{ width: 1, height: 36, background: T.cardBorder }}></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ padding: '5px 10px', borderRadius: 8, background: scoreBg(comp.score), border: "1px solid " + scoreColor(comp.score) + '30' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor(comp.score) }}>{comp.score >= 60 ? 'Healthy' : comp.score >= 40 ? 'Mixed' : 'Struggling'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: T.textMuted, background: T.pageBg, padding: '6px 12px', borderRadius: 7, border: "1px solid " + T.cardBorder }}>No data yet · click Scan</div>
                  )}
                  <button onClick={() => scan(comp.id)} disabled={scanning === comp.id} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: scanning === comp.id ? T.purpleLight : T.purple, color: scanning === comp.id ? T.purple : T.white, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="ti ti-refresh" style={{ fontSize: 12 }} aria-hidden="true"></i>{scanning === comp.id ? 'Scanning…' : 'Scan'}
                  </button>
                  <button onClick={() => del(comp.id)} style={{ padding: '7px 10px', borderRadius: 8, border: "1px solid " + T.cardBorder, background: T.white, color: T.red, fontSize: 11, cursor: 'pointer' }}>
                    <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true"></i>
                  </button>
                </div>
              </div>
              {comp.total > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + T.cardBorder }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[['Positive', comp.positive, T.green], ['Neutral', comp.neutral, '#A78BFA'], ['Negative', comp.negative, T.red]].map(([label, val, color]) => (
                      <div key={label} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: T.textMuted }}>{label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color }}>{comp.total ? Math.round(val / comp.total * 100) : 0}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: T.pageBg, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: color, width: (comp.total ? val / comp.total * 100 : 0) + '%' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {comp.recent_mentions?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recent mentions</div>
                      {comp.recent_mentions.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7, padding: '8px 10px', background: T.pageBg, borderRadius: 7 }}>
                          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: m.sentiment === 'positive' ? T.greenLight : m.sentiment === 'negative' ? T.redLight : T.purpleLight, color: sentColor(m.sentiment), fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{m.sentiment}</span>
                          <span style={{ fontSize: 11, color: T.textPrimary, lineHeight: 1.5, flex: 1 }}>{m.content}</span>
                          <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>{m.fetched_at}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

// ── Alerts page ───────────────────────────────────────────────────────────────
function AlertsPage({ business }) {
  const [alertOn, setAlertOn] = useState(true);
  const [digest, setDigest] = useState(true);
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };
  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? T.purple : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
    </div>
  );
  return (
    <Page>
      <PageHead title="Alert settings" subtitle="Control when and how Senti notifies you" />
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>Notification preferences</div>
        {[{ label: 'Instant negative alerts', sub: 'Get an email immediately when a negative mention is detected', value: alertOn, onChange: setAlertOn }, { label: 'Daily digest email', sub: 'Receive a summary of all mentions every morning at 8:00 AM', value: digest, onChange: setDigest }].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{item.label}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{item.sub}</div>
            </div>
            <Toggle value={item.value} onChange={item.onChange} />
          </div>
        ))}
        <button onClick={save} style={{ marginTop: 18, padding: '10px 24px', borderRadius: 9, border: 'none', background: saved ? T.green : T.purple, color: T.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
          {saved ? 'Saved ✓' : 'Save preferences'}
        </button>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Alert history</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Recent alerts sent to {business?.alert_email}</div>
        <div style={{ textAlign: 'center', padding: '28px', background: T.pageBg, borderRadius: 9, border: `1px solid ${T.cardBorder}`, color: T.textMuted, fontSize: 12 }}>Alert history will appear here once you receive notifications</div>
      </Card>
    </Page>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────
function SettingsPage({ user, onLogout }) {
  return (
    <Page>
      <PageHead title="Settings" subtitle="Manage your account and plan" />
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>Account</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: T.white }}>{user?.full_name?.charAt(0) || 'U'}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{user?.full_name || 'User'}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{user?.email}</div>
            <div style={{ fontSize: 11, color: T.green, marginTop: 3, fontWeight: 600 }}>Account owner</div>
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Current plan</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: T.purpleSoft, borderRadius: 9, marginBottom: 14, border: `1px solid ${T.purpleMid}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>MVP Pilot</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>1 business · Reddit, Google, Play Store · Email alerts</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: T.white, color: '#5B21B6', border: `1px solid ${T.purpleMid}` }}>Active</span>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>Coming in Version 2</div>
        {['WhatsApp and Instagram inbox', 'Weekly PDF reports', 'Ticketing system with SLA', 'Teams and multi-agent support', 'Skill-based routing'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textMuted, padding: '8px 11px', background: T.pageBg, borderRadius: 7, border: `1px solid ${T.cardBorder}`, marginBottom: 6 }}>
            <i className="ti ti-lock" style={{ fontSize: 12, color: T.textHint }} aria-hidden="true"></i>{f}
          </div>
        ))}
      </Card>
      <Card style={{ background: T.redLight, border: `1px solid ${T.redBorder}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 4 }}>Sign out</div>
        <div style={{ fontSize: 12, color: `${T.red}99`, marginBottom: 14 }}>You will be redirected to the login page</div>
        <button onClick={onLogout} style={{ padding: '9px 22px', borderRadius: 8, border: `1px solid ${T.redBorder}`, background: T.white, color: T.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign out of Senti</button>
      </Card>
    </Page>
  );
}

// ── Team page ─────────────────────────────────────────────────────────────────
function TeamPage({ business, user }) {
  const [members, setMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteName, setInviteName] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('agent');
  const [inviting, setInviting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const load = async () => {
    setLoading(true);
    try { const r = await api.get(`/businesses/${business.id}/team`); setMembers(r.data); } catch {}
    setLoading(false);
  };
  React.useEffect(() => { if (business?.id) load(); }, [business?.id]);
  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setError(''); setSuccess('');
    try {
      await api.post(`/businesses/${business.id}/team/invite`, { email: inviteEmail.trim(), full_name: inviteName.trim(), role: inviteRole });
      setSuccess(`Invitation sent to ${inviteEmail}`); setInviteEmail(''); setInviteName('');
      await load();
    } catch (e) { setError(e.response?.data?.detail || 'Failed to invite'); }
    setInviting(false);
  };
  const remove = async (id) => {
    if (!window.confirm('Remove this team member?')) return;
    try { await api.delete(`/businesses/${business.id}/team/${id}`); setMembers(prev => prev.filter(m => m.id !== id)); } catch {}
  };
  const roleColor = r => r === 'owner' ? T.purple : r === 'manager' ? '#0284C7' : T.green;
  const roleBg = r => r === 'owner' ? T.purpleLight : r === 'manager' ? '#E0F2FE' : T.greenLight;
  return (
    <Page>
      <PageHead title="Team" subtitle="Manage your team members and their access" />
      {error && <div style={{ background: T.redLight, border: `1px solid ${T.redBorder}`, borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 12, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 8, padding: '10px 14px', color: T.green, fontSize: 12, marginBottom: 14 }}>✓ {success}</div>}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Invite team member</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>Team members can view and respond to mentions based on their role.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" style={{ flex: 1, minWidth: 130, padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', color: T.textPrimary, background: T.pageBg }} />
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" style={{ flex: 2, minWidth: 190, padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', color: T.textPrimary, background: T.pageBg }} />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', color: T.textPrimary, background: T.white }}>
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
          </select>
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: T.purple, color: T.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: inviting ? 0.6 : 1 }}>{inviting ? 'Sending…' : 'Send invite'}</button>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[{ role: 'Owner', color: T.purple, bg: T.purpleLight, desc: 'Full access. Manage team, settings, billing.' }, { role: 'Manager', color: '#0284C7', bg: '#E0F2FE', desc: 'View all mentions, assign, resolve, configure alerts.' }, { role: 'Agent', color: T.green, bg: T.greenLight, desc: 'View and respond to assigned mentions only.' }].map(r => (
          <Card key={r.role}>
            <span style={{ fontSize: 11, fontWeight: 700, background: r.bg, color: r.color, padding: '3px 9px', borderRadius: 10 }}>{r.role}</span>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 8, lineHeight: 1.5 }}>{r.desc}</div>
          </Card>
        ))}
      </div>
      <Card style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.cardBorder}`, fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Team members <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 400 }}>({members.length})</span></div>
        {loading ? <div style={{ padding: 36, textAlign: 'center', color: T.textMuted }}>Loading…</div> : (
          members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < members.length - 1 ? `1px solid ${T.cardBorder}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: roleBg(m.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: roleColor(m.role), flexShrink: 0 }}>{(m.full_name || m.email || '?').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{m.full_name || m.email}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{m.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: roleBg(m.role), color: roleColor(m.role), padding: '2px 8px', borderRadius: 10 }}>{m.role}</span>
                {m.status === 'pending' && <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 10 }}>Pending</span>}
                <span style={{ fontSize: 11, color: T.textMuted }}>{m.assigned_count} assigned</span>
                {m.role !== 'owner' && (
                  <>
                    <select value={m.role} onChange={e => api.patch(`/businesses/${business.id}/team/${m.id}`, { role: e.target.value }).then(() => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, role: e.target.value } : x)))} style={{ fontSize: 11, padding: '3px 7px', borderRadius: 6, border: `1px solid ${T.cardBorder}`, outline: 'none', color: T.textPrimary, background: T.white }}>
                      <option value="agent">Agent</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button onClick={() => remove(m.id)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.red, fontSize: 11, cursor: 'pointer' }}>Remove</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </Page>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setError('');
    try {
      const form = new URLSearchParams();
      form.append('username', email); form.append('password', password);
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.access_token); onLogin();
    } catch (e) { setError(e.response?.data?.detail || 'Incorrect email or password'); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F5F2FC 0%, #EDE9FE 50%, #F0EDF8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', width: 920, background: T.white, borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(124,58,237,0.15)', border: `1px solid ${T.purpleMid}` }}>
        <div style={{ width: 400, background: 'linear-gradient(160deg, #3B0764 0%, #4C1D95 40%, #7C3AED 100%)', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.white }}>S</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.white, letterSpacing: '-0.02em' }}>Senti</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.white, lineHeight: 1.25, marginBottom: 14, letterSpacing: '-0.02em' }}>Know what your community is saying</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 36 }}>Monitor brand mentions, score sentiment in real time, and respond before problems become crises.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {['Real-time social listening across Reddit, Google and Play Store', 'AI sentiment analysis on every mention', 'Instant crisis alerts and spike detection', 'AI-powered reply suggestions'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(22,163,74,0.25)', border: '1px solid rgba(22,163,74,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#86EFAC', flexShrink: 0, marginTop: 1 }}>✓</div>{f}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>"Senti helped us catch a negative trend before it went viral. Game changer."</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>— Beta customer</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, marginBottom: 6, letterSpacing: '-0.02em' }}>Welcome back</div>
            <div style={{ fontSize: 14, color: T.textMuted }}>Sign in to your Senti account</div>
          </div>
          {error && <div style={{ background: T.redLight, color: T.red, borderRadius: 9, padding: '11px 14px', fontSize: 13, marginBottom: 20, border: `1px solid ${T.redBorder}` }}>{error}</div>}
          {[['Email address', email, setEmail, 'email', 'you@company.com'], ['Password', password, setPassword, 'password', 'Your password']].map(([label, val, setter, type, ph]) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 7 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder={ph} type={type}
                style={{ width: '100%', padding: '12px 15px', borderRadius: 10, border: `1px solid ${T.cardBorder}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: T.pageBg, color: T.textPrimary, transition: 'border-color 0.15s' }} />
            </div>
          ))}
          <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: loading ? T.purpleMid : 'linear-gradient(135deg, #4C1D95, #7C3AED)', color: T.white, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', marginTop: 4, marginBottom: 16, letterSpacing: '-0.01em', boxShadow: '0 4px 14px rgba(124,58,237,0.35)', transition: 'opacity 0.2s' }}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted }}>No account? <span onClick={onSwitch} style={{ color: T.purple, cursor: 'pointer', fontWeight: 700 }}>Create one free</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Signup ────────────────────────────────────────────────────────────────────
function Signup({ onSignup, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/signup', { email, password, full_name: name });
      const form = new URLSearchParams(); form.append('username', email); form.append('password', password);
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.access_token); onSignup();
    } catch (e) { setError(e.response?.data?.detail || 'Signup failed'); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 460, background: T.white, borderRadius: 18, padding: '44px', boxShadow: '0 20px 60px rgba(19,8,38,0.10)', border: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: T.white }}>S</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.01em' }}>Senti</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, marginBottom: 6, letterSpacing: '-0.01em' }}>Create your account</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 26 }}>Start monitoring your community in minutes.</div>
        {error && <div style={{ background: T.redLight, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>{error}</div>}
        {[['Full name', name, setName, 'text', 'Your full name'], ['Email address', email, setEmail, 'email', 'you@company.com'], ['Password', password, setPassword, 'password', 'Choose a strong password']].map(([label, val, setter, type, ph]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>{label}</label>
            <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} type={type}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${T.cardBorder}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: T.pageBg, color: T.textPrimary }} />
          </div>
        ))}
        <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: T.sbBg, color: T.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6, marginBottom: 14 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted }}>Already have an account? <span onClick={onSwitch} style={{ color: T.purple, cursor: 'pointer', fontWeight: 700 }}>Sign in</span></div>
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const steps = [
    { title: 'Business name', sub: 'We will search for mentions of this name across Reddit and Google' },
    { title: 'Keywords to monitor', sub: 'Add product names, services, or variations of your business name' },
    { title: 'Alert email', sub: 'Where should we send instant alerts when a negative mention is detected?' },
  ];
  const finish = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/businesses', { name, keywords, alert_email: alertEmail, alert_on_negative: true, daily_digest: true });
      onDone(res.data);
    } catch { setError('Could not save. Please try again.'); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 560, background: T.white, borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(19,8,38,0.10)', border: `1px solid ${T.cardBorder}` }}>
        <div style={{ background: T.sbBg, padding: '28px 38px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: T.white }}>S</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.white }}>Senti</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 5, letterSpacing: '-0.01em' }}>Set up your monitoring</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>3 quick steps and you are live</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 18 }}>
            {[1,2,3].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= step ? T.purple : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />)}
          </div>
        </div>
        <div style={{ padding: '32px 38px' }}>
          {error && <div style={{ background: T.redLight, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>{error}</div>}
          <div style={{ fontSize: 10, fontWeight: 700, color: T.purple, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Step {step} of 3</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, marginBottom: 5, letterSpacing: '-0.01em' }}>{steps[step - 1].title}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 22, lineHeight: 1.6 }}>{steps[step - 1].sub}</div>
          {step === 1 && <>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maple Leaf Groceries" style={{ width: '100%', padding: '12px 14px', borderRadius: 9, border: `1px solid ${T.cardBorder}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: T.textPrimary, background: T.pageBg, marginBottom: 18 }} />
            <button onClick={() => name && setStep(2)} disabled={!name} style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: name ? T.sbBg : T.gray200, color: name ? T.white : T.gray400, fontSize: 14, fontWeight: 700, cursor: name ? 'pointer' : 'default' }}>Continue</button>
          </>}
          {step === 2 && <>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. maple leaf groceries, MLG, toronto grocery" style={{ width: '100%', padding: '12px 14px', borderRadius: 9, border: `1px solid ${T.cardBorder}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: T.textPrimary, background: T.pageBg, marginBottom: 7 }} />
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 18 }}>Add 3 to 5 specific terms your customers would use</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, borderRadius: 9, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.gray600, fontSize: 14, cursor: 'pointer' }}>Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: 12, borderRadius: 9, border: 'none', background: T.sbBg, color: T.white, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Continue</button>
            </div>
          </>}
          {step === 3 && <>
            <input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="alerts@yourbusiness.com" type="email" style={{ width: '100%', padding: '12px 14px', borderRadius: 9, border: `1px solid ${T.cardBorder}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: T.textPrimary, background: T.pageBg, marginBottom: 12 }} />
            <div style={{ background: T.purpleSoft, border: `1px solid ${T.purpleMid}`, borderRadius: 9, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#5B21B6', lineHeight: 1.6 }}>You will receive an instant email the moment a negative mention is detected.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, borderRadius: 9, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.gray600, fontSize: 14, cursor: 'pointer' }}>Back</button>
              <button onClick={finish} disabled={loading || !alertEmail} style={{ flex: 2, padding: 12, borderRadius: 9, border: 'none', background: alertEmail ? T.purple : T.gray200, color: T.white, fontSize: 14, fontWeight: 700, cursor: alertEmail ? 'pointer' : 'default' }}>
                {loading ? 'Starting…' : 'Start monitoring'}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [adminToken, setAdminToken] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [confirmSuspend, setConfirmSuspend] = useState(null);
  const [editingKeywords, setEditingKeywords] = useState({});
  const [scanningBiz, setScanningBiz] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
const aH = (t) => ({ headers: { Authorization: `Bearer ${t || adminToken}` } }); useEffect(() => { const at = localStorage.getItem('token'); if (!at) return; (async () => { try { const me = await api.get('/auth/me'); if (me.data.is_admin) { setAdminToken(at); await loadData(at); setAuthed(true); } } catch {} })(); }, []);

  const loadData = async (t) => {
    const tk = t || adminToken;
    const [s, c] = await Promise.all([api.get('/admin/stats', aH(tk)), api.get('/admin/customers', aH(tk))]);
    setStats(s.data);
    setCustomers(Array.isArray(c.data) ? c.data : []);
  };

  const login = async () => {
    setLoading(true); setError('');
    try {
      const form = new URLSearchParams(); form.append('username', email); form.append('password', password);
      const res = await api.post('/auth/login', form);
      const token = res.data.access_token;
      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!me.data.is_admin) { setError('Not an admin account'); setLoading(false); return; }
      setAdminToken(token);
      await loadData(token);
      setAuthed(true);
    } catch { setError('Invalid credentials'); }
    setLoading(false);
  };

  const toggle = async (bizId, field, val) => {
    await api.patch(`/admin/businesses/${bizId}`, { [field]: val }, aH());
    setCustomers(prev => prev.map(c => c.business_id === bizId ? { ...c, [field]: val } : c));
  };

  const doSuspend = async (userId, isActive) => {
    await api.patch(`/admin/users/${userId}`, { is_active: isActive }, aH());
    setCustomers(prev => prev.map(c => c.user_id === userId ? { ...c, is_active: isActive } : c));
    setConfirmSuspend(null);
  };

  const triggerScan = async (bizId) => {
    setScanningBiz(bizId);
    try { await api.post(`/admin/businesses/${bizId}/scan`, {}, aH()).catch(() => {}); } catch {}
    setTimeout(() => { loadData(); setScanningBiz(null); }, 3000);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const ms = !q || c.user_email?.toLowerCase().includes(q) || c.business_name?.toLowerCase().includes(q) || c.user_name?.toLowerCase().includes(q);
    const mf = filterStatus === 'all' || (filterStatus === 'active' && c.is_active) || (filterStatus === 'inactive' && !c.is_active);
    return ms && mf;
  });

  const Tog = ({ value, onChange }) => (
    <div onClick={onChange} style={{ width: 34, height: 19, borderRadius: 10, background: value ? T.purple : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, margin: '0 auto' }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: T.sbBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 400, background: '#162032', borderRadius: 16, padding: '42px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: T.white }}>S</div>
          <div><div style={{ fontSize: 15, fontWeight: 800, color: T.white }}>Senti Admin</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Platform management</div></div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 5 }}>Admin sign in</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 26 }}>Restricted access. Admin credentials required.</div>
        {error && <div style={{ background: T.redLight, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>{error}</div>}
        {[['Email', email, setEmail, 'email'], ['Password', password, setPassword, 'password']].map(([label, val, setter, type]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
            <input value={val} onChange={e => setter(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} type={type} style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', color: T.white }} />
          </div>
        ))}
        <button onClick={login} disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: T.purple, color: T.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
          {loading ? 'Signing in…' : 'Sign in to Admin'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, fontFamily: 'system-ui, sans-serif' }}>
      {confirmSuspend && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: T.white, borderRadius: 14, padding: '30px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 7 }}>{confirmSuspend.is_active ? 'Suspend customer?' : 'Activate customer?'}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 22, lineHeight: 1.6 }}>{confirmSuspend.is_active ? `This will suspend ${confirmSuspend.user_name} and disable all monitoring.` : `This will reactivate ${confirmSuspend.user_name} and resume monitoring.`}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmSuspend(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.gray600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => doSuspend(confirmSuspend.user_id, !confirmSuspend.is_active)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: confirmSuspend.is_active ? T.red : T.purple, color: T.white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmSuspend.is_active ? 'Yes, suspend' : 'Yes, activate'}</button>
            </div>
          </div>
        </div>
      )}
      {selectedCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedCustomer(null)}>
          <div style={{ width: 460, background: T.white, height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '22px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.sbBg }}>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{selectedCustomer.user_name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{selectedCustomer.user_email}</div></div>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '22px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Account info</div>
              <div style={{ background: T.pageBg, borderRadius: 10, padding: '4px 14px', marginBottom: 18, border: `1px solid ${T.cardBorder}` }}>
                {[['User ID', `#${selectedCustomer.user_id}`], ['Email', selectedCustomer.user_email], ['Status', selectedCustomer.is_active ? 'Active' : 'Suspended'], ['Alert email', selectedCustomer.alert_email || 'Not set']].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.cardBorder}`, fontSize: 12 }}>
                    <span style={{ color: T.textMuted }}>{label}</span>
                    <span style={{ color: T.textPrimary, fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, marginBottom: 18 }}>
                {[['Mentions', selectedCustomer.mention_count, T.purple], ['Positive', selectedCustomer.positive_count, T.green], ['Negative', selectedCustomer.negative_count, T.red]].map(([label, val, color]) => (
                  <div key={label} style={{ background: T.pageBg, borderRadius: 9, padding: 13, textAlign: 'center', border: `1px solid ${T.cardBorder}` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 3 }}>{val}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Keywords</div>
              <textarea value={editingKeywords[selectedCustomer.business_id] !== undefined ? editingKeywords[selectedCustomer.business_id] : selectedCustomer.keywords} onChange={e => setEditingKeywords(prev => ({ ...prev, [selectedCustomer.business_id]: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: T.textPrimary, resize: 'vertical', marginBottom: 8 }} />
              {editingKeywords[selectedCustomer.business_id] !== undefined && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setEditingKeywords(prev => ({ ...prev, [selectedCustomer.business_id]: undefined }))} style={{ flex: 1, padding: 8, borderRadius: 7, border: `1px solid ${T.cardBorder}`, background: T.white, fontSize: 12, cursor: 'pointer', color: T.gray600 }}>Cancel</button>
                  <button onClick={async () => { await api.patch(`/admin/businesses/${selectedCustomer.business_id}`, { keywords: editingKeywords[selectedCustomer.business_id] }, aH()); setCustomers(prev => prev.map(c => c.business_id === selectedCustomer.business_id ? { ...c, keywords: editingKeywords[selectedCustomer.business_id] } : c)); setEditingKeywords(prev => ({ ...prev, [selectedCustomer.business_id]: undefined })); }} style={{ flex: 2, padding: 8, borderRadius: 7, border: 'none', background: T.sbBg, fontSize: 12, cursor: 'pointer', color: T.white, fontWeight: 700 }}>Save keywords</button>
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, marginTop: 16 }}>Channel controls</div>
              <div style={{ background: T.pageBg, borderRadius: 10, padding: '4px 14px', marginBottom: 18, border: `1px solid ${T.cardBorder}` }}>
                {[['Reddit monitoring', 'reddit_enabled', selectedCustomer.reddit_enabled], ['Google Reviews', 'google_enabled', selectedCustomer.google_enabled]].map(([label, field, val]) => (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                    <span style={{ fontSize: 13, color: T.textPrimary }}>{label}</span>
                    <Tog value={val} onChange={() => toggle(selectedCustomer.business_id, field, !val)} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={() => triggerScan(selectedCustomer.business_id)} disabled={scanningBiz === selectedCustomer.business_id} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: T.purple, color: T.white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{scanningBiz === selectedCustomer.business_id ? 'Scanning…' : 'Trigger scan'}</button>
                <button onClick={() => setConfirmSuspend(selectedCustomer)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${selectedCustomer.is_active ? T.redBorder : T.purpleMid}`, background: selectedCustomer.is_active ? T.redLight : T.purpleLight, color: selectedCustomer.is_active ? T.red : T.purple, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{selectedCustomer.is_active ? 'Suspend' : 'Activate'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ background: T.sbBg, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: T.white }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.white }}>Senti</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>/ Admin Panel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} disabled={refreshing} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={() => setAuthed(false)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: 18 }}><div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, marginBottom: 3 }}>Platform overview</div><div style={{ fontSize: 12, color: T.textMuted }}>All customers and businesses on Senti</div></div>
        <div style={{ background: T.sbBg, borderRadius: 10, padding: '12px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>System health</div>
          {[['Scheduler', 'Running'], ['Groq AI', 'Connected'], ['Database', 'Healthy'], ['SSL', 'Valid']].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 5px ${T.green}` }}></div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
              <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 11, marginBottom: 18 }}>
          {[{ label: 'Total customers', val: stats?.total_users || 0, color: T.purple, bg: T.purpleLight, icon: 'ti-users' }, { label: 'Active businesses', val: stats?.active_businesses || 0, color: '#5B21B6', bg: T.purpleSoft, icon: 'ti-building-store' }, { label: 'Total mentions', val: stats?.total_mentions || 0, color: T.blue, bg: '#E0F2FF', icon: 'ti-messages' }, { label: 'Negative', val: stats?.negative_mentions || 0, color: T.red, bg: T.redLight, icon: 'ti-alert-triangle' }, { label: 'Sentiment', val: stats?.total_mentions ? Math.round(stats.positive_mentions / stats.total_mentions * 100) : 0, suffix: '/100', color: T.amber, bg: T.amberLight, icon: 'ti-chart-pie' }].map(s => (
            <div key={s.label} style={{ background: T.white, borderRadius: 10, padding: 15, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: s.color, marginBottom: 10 }}><i className={`ti ${s.icon}`} aria-hidden="true"></i></div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.textPrimary, marginBottom: 3 }}>{s.val}{s.suffix || ''}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Customers <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 400 }}>({filtered.length})</span></div>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or business…" style={{ padding: '8px 13px', borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, outline: 'none', background: T.pageBg, color: T.textPrimary, width: 240 }} />
              {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
                <button key={val} onClick={() => setFilterStatus(val)} style={{ fontSize: 11, padding: '6px 13px', borderRadius: 7, border: `1px solid ${filterStatus === val ? T.purple : T.cardBorder}`, background: filterStatus === val ? T.purpleLight : T.white, color: filterStatus === val ? T.purple : T.gray600, cursor: 'pointer', fontWeight: filterStatus === val ? 700 : 400 }}>{label}</button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px', color: T.textMuted }}><i className="ti ti-users" style={{ fontSize: 34, display: 'block', marginBottom: 10, color: T.purpleMid }} aria-hidden="true"></i><div style={{ fontSize: 14, fontWeight: 700, color: T.textSecondary, marginBottom: 5 }}>No customers found</div></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.cardBorder}` }}>
                    {['Customer', 'Business', 'Mentions', 'Score', 'Last scan', 'Reddit', 'Google', 'Status', 'Actions'].map(h => <th key={h} style={{ padding: '10px 11px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.business_id} onClick={() => setSelectedCustomer(c)} style={{ borderBottom: `1px solid ${T.pageBg}`, cursor: 'pointer', background: i % 2 === 0 ? T.white : T.pageBg }}
                      onMouseEnter={e => e.currentTarget.style.background = T.purpleSoft}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? T.white : T.pageBg}>
                      <td style={{ padding: '13px 11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.white, flexShrink: 0 }}>{(c.user_name || '?').charAt(0).toUpperCase()}</div>
                          <div><div style={{ fontWeight: 700, color: T.textPrimary, marginBottom: 1 }}>{c.user_name || 'Unknown'}</div><div style={{ color: T.textMuted, fontSize: 10 }}>{c.user_email}</div></div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 11px' }}><div style={{ fontWeight: 600, color: T.textPrimary, marginBottom: 1 }}>{c.business_name}</div><div style={{ color: T.textHint, fontSize: 9, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.keywords}</div></td>
                      <td style={{ padding: '13px 11px', textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary }}>{c.mention_count}</div><div style={{ fontSize: 9, color: T.red }}>{c.negative_count} neg</div></td>
                      <td style={{ padding: '13px 11px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: c.sentiment_score >= 60 ? T.green : c.sentiment_score >= 40 ? T.amber : T.red }}>{c.sentiment_score}</div><div style={{ fontSize: 9, color: T.textMuted }}>/100</div></td>
                      <td style={{ padding: '13px 11px' }}><div style={{ fontSize: 11, color: T.textSecondary, whiteSpace: 'nowrap' }}>{c.last_scan ? new Date(c.last_scan).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : 'Never'}</div></td>
                      <td style={{ padding: '13px 11px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggle(c.business_id, 'reddit_enabled', !c.reddit_enabled); }}><Tog value={c.reddit_enabled} onChange={() => {}} /></td>
                      <td style={{ padding: '13px 11px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggle(c.business_id, 'google_enabled', !c.google_enabled); }}><Tog value={c.google_enabled} onChange={() => {}} /></td>
                      <td style={{ padding: '13px 11px', textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.is_active ? T.greenLight : T.redLight, color: c.is_active ? T.green : T.red, whiteSpace: 'nowrap' }}>{c.is_active ? 'Active' : 'Suspended'}</span></td>
                      <td style={{ padding: '13px 11px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => triggerScan(c.business_id)} disabled={scanningBiz === c.business_id} style={{ fontSize: 10, padding: '5px 9px', borderRadius: 6, border: `1px solid ${T.cardBorder}`, background: T.white, color: T.purple, cursor: 'pointer', fontWeight: 600 }}>{scanningBiz === c.business_id ? '…' : 'Scan'}</button>
                          <button onClick={() => setConfirmSuspend(c)} style={{ fontSize: 10, padding: '5px 9px', borderRadius: 6, border: `1px solid ${c.is_active ? T.redBorder : T.purpleMid}`, background: c.is_active ? T.redLight : T.purpleLight, color: c.is_active ? T.red : T.purple, cursor: 'pointer', fontWeight: 600 }}>{c.is_active ? 'Suspend' : 'Activate'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard shell ──────────────────────────────────────────────────────
function Dashboard({ user, business, onLogout }) {
  const [stats, setStats] = useState(null);
  const [mentions, setMentions] = useState([]);
  const [allMentions, setAllMentions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [mentionLimit, setMentionLimit] = useState(100);
  const [dateRange, setDateRange] = useState('7 days');

  useEffect(() => { loadData(); }, [filter, mentionLimit]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, mRes, allRes] = await Promise.all([
        api.get(`/businesses/${business.id}/stats`),
        api.get(`/businesses/${business.id}/mentions${filter !== 'all' ? `?sentiment=${filter}&limit=${mentionLimit}` : `?limit=${mentionLimit}`}`),
        api.get(`/businesses/${business.id}/mentions?limit=10000`),
      ]);
      setStats(sRes.data); setMentions(mRes.data); setAllMentions(allRes.data);
    } catch {}
    setLoading(false);
  };

  const renderPage = () => {
    switch (activeNav) {
      case 'dashboard': return <DashboardPage business={business} stats={stats} allMentions={allMentions} onNavigate={setActiveNav} />;
      case 'inbox': return <InboxPage business={business} mentions={mentions} setMentions={setMentions} filter={filter} setFilter={setFilter} loading={loading} onRefresh={loadData} mentionLimit={mentionLimit} setMentionLimit={setMentionLimit} />;
      case 'analytics': return <AnalyticsPage business={business} allMentions={allMentions} />;
      case 'business': return <MyBusinessPage business={business} />;
      case 'alerts': return <AlertsPage business={business} />;
      case 'settings': return <SettingsPage user={user} onLogout={onLogout} />;
      case 'ai-analyst': return <AIAnalystPage business={business} />;
      case 'ai-agent': return <AIAgentPage business={business} />;
      case 'competitors': return <CompetitorPage business={business} />;
      case 'team': return <TeamPage business={business} user={user} />;
      default: return <DashboardPage business={business} stats={stats} allMentions={allMentions} onNavigate={setActiveNav} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: T.pageBg }}>
      <Sidebar active={activeNav} setActive={setActiveNav} business={business} user={user} stats={stats} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar dateRange={dateRange} setDateRange={setDateRange} onRefresh={loadData} />
        {renderPage()}
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
const mobileStyle = `
  @media (max-width: 768px) {
    .senti-app { flex-direction: column !important; }
    .senti-sidebar { width: 100% !important; height: auto !important; flex-direction: row !important; overflow-x: auto !important; }
    .senti-content { width: 100% !important; }
    .senti-metrics { grid-template-columns: 1fr 1fr !important; }
    .senti-two-col { grid-template-columns: 1fr !important; }
    .senti-right-col { display: none !important; }
  }
`;

function MobileBanner() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;
  return (
    <div style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1E2433', padding: '14px 18px', zIndex: 9999, alignItems: 'center', justifyContent: 'space-between', gap: 10, cssText: '@media(max-width:768px){display:flex!important}' }}>
      <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>Senti works best on desktop.</span> For the full experience open on a laptop or computer.
      </div>
      <button onClick={() => setDismissed(true)} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Got it</button>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPanel />;
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  useEffect(() => { if (localStorage.getItem('token')) loadUser(); }, []);
  const loadUser = async () => {
    try {
      const uRes = await api.get('/auth/me'); setUser(uRes.data);
      if (uRes.data.is_admin) { window.location.href = '/admin'; return; }
      const bRes = await api.get('/businesses');
      if (bRes.data.length > 0) { setBusiness(bRes.data[0]); setScreen('dashboard'); }
      else setScreen('onboarding');
    } catch { localStorage.removeItem('token'); setScreen('login'); }
  };
  if (screen === 'login') return <Login onLogin={loadUser} onSwitch={() => setScreen('signup')} />;
  if (screen === 'signup') return <Signup onSignup={loadUser} onSwitch={() => setScreen('login')} />;
  if (screen === 'onboarding') return <Onboarding onDone={biz => { setBusiness(biz); setScreen('dashboard'); }} />;
  if (screen === 'dashboard') return <Dashboard user={user} business={business} onLogout={() => { localStorage.removeItem('token'); setUser(null); setBusiness(null); setScreen('login'); }} />;
  return null;
}
