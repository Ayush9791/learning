'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function streak(sessions: any[]) {
  const days = new Set(sessions.map(s => dayKey(new Date(s.started_at))))
  const date = new Date()
  if (!days.has(dayKey(date))) date.setDate(date.getDate()-1)
  let count = 0
  while (days.has(dayKey(date))) { count++; date.setDate(date.getDate()-1) }
  return count
}
function completedLessonIds(lessons: any[] = [], sessions: any[] = []) {
  return new Set(lessons.filter(lesson => {
    const watched = sessions.filter(s => s.lesson_id === lesson.id).reduce((sum,s) => sum + Number(s.seconds || 0), 0)
    const duration = Number(lesson.duration_seconds || 0)
    return duration > 0 && watched >= Math.ceil(duration * .8)
  }).map(lesson => lesson.id))
}
function minutes(sessions: any[]) { return Math.floor(sessions.reduce((sum,s) => sum + Number(s.seconds || 0), 0) / 60) }

export default function Dashboard({ user, initialTracks, initialSessions }: { user:any, initialTracks:any[], initialSessions:any[] }) {
  const [tracks,setTracks] = useState(initialTracks)
  const [sessions] = useState(initialSessions)
  const [open,setOpen] = useState(false)
  const [url,setUrl] = useState('')
  const [goalType,setGoalType] = useState('minutes')
  const [goal,setGoal] = useState(30)
  const [busy,setBusy] = useState(false)
  const [imported,setImported] = useState<any>(null)
  const [tab,setTab] = useState('overview')
  const [filter,setFilter] = useState('')
  const [error,setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const today = dayKey()
  const todaySessions = sessions.filter(s => dayKey(new Date(s.started_at)) === today)
  const totalMinutes = minutes(todaySessions)
  const currentStreak = streak(sessions)
  const completedToday = tracks.filter(t => {
    const own = todaySessions.filter(s => s.track_id === t.id)
    const seconds = own.reduce((sum,s) => sum + Number(s.seconds || 0), 0)
    return t.goal_type === 'minutes' ? seconds >= t.daily_goal * 60 : completedLessonIds(t.lessons || [], own).size >= t.daily_goal
  }).length
  const visibleTracks = useMemo(() => tracks.filter(t => t.title.toLowerCase().includes(filter.toLowerCase())), [tracks,filter])

  async function importPlaylist() {
    setBusy(true); setError(''); setImported(null)
    try {
      const response = await fetch('/api/youtube/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playlistUrl:url})})
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Playlist could not be imported.')
      setImported(result)
    } catch (e:any) { setError(e.message || 'Something went wrong. Try again.') }
    finally { setBusy(false) }
  }
  async function createTrack() {
    if (!imported) return
    if (!Number.isInteger(goal) || goal < 1 || goal > 1440) { setError('Choose a daily goal between 1 and 1440.'); return }
    setBusy(true); setError('')
    const { data,error:dbError } = await supabase.rpc('create_track_with_lessons',{p_track:{user_id:user.id,title:imported.playlist.title,description:imported.playlist.description,playlist_id:imported.playlist.id,thumbnail_url:imported.playlist.thumbnail_url,goal_type:goalType,daily_goal:goal},p_lessons:imported.lessons})
    if (dbError) { setError('Track could not be saved. Please try again.'); setBusy(false); return }
    if (data?.track) { setTracks(current => [{...data.track,lessons:data.lessons || []},...current]); setOpen(false); setUrl(''); setImported(null) }
    else setError('The server returned an unexpected response.')
    setBusy(false)
  }
  async function signOut() { await supabase.auth.signOut(); router.push('/login'); router.refresh() }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="wordmark" href="/dashboard"><span className="wordmark-icon">l.</span><span>fieldnotes<small>LEARNING STUDIO</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={tab==='overview'?'selected':''} onClick={()=>setTab('overview')}><span>01</span>Overview</button>
        <button className={tab==='tracks'?'selected':''} onClick={()=>setTab('tracks')}><span>02</span>My library <b>{tracks.length}</b></button>
        <button className={tab==='settings'?'selected':''} onClick={()=>setTab('settings')}><span>03</span>Settings</button>
      </nav>
      <div className="sidebar-note"><span className="tiny-sun">✳</span><p>Small steps add up.<br/>Make room to learn today.</p></div>
      <div className="account-row"><div className="avatar">{(user.email || 'U')[0].toUpperCase()}</div><div className="account-copy"><strong>Your workspace</strong><span>{user.email}</span></div><button className="icon-button signout" aria-label="Sign out" title="Sign out" onClick={signOut}>↗</button></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div className="breadcrumb">YOUR SPACE <span>/</span> {tab==='overview'?'OVERVIEW':tab==='tracks'?'LIBRARY':'PREFERENCES'}</div><div className="topbar-right"><span className="date-label">{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><button className="button button-dark" onClick={()=>{setOpen(true);setError('')}}><span>＋</span> Add a playlist</button></div></header>
      {tab==='settings' ? <section className="page-content"><div className="page-intro"><p className="kicker">YOUR PREFERENCES</p><h1>Keep things <em>simple.</em></h1><p className="intro-copy">A little housekeeping for your learning space.</p></div><div className="settings-list"><article className="setting-row"><div><p className="kicker">01 / STORAGE</p><h3>Cloud sync</h3><p>Your tracks and study history are linked to your account.</p></div><span className="connection"><i/> Connected</span></article><article className="setting-row"><div><p className="kicker">02 / VIDEO</p><h3>YouTube imports</h3><p>Playlist details are fetched securely on the server. API credentials are not exposed in the browser.</p></div><span className="connection"><i/> Server-side</span></article></div></section> :
      <section className="page-content">
        <div className="page-intro"><p className="kicker">{tab==='overview'?'MONDAY MINDSET · YOUR LEARNING SPACE':'YOUR COLLECTION'}</p><h1>{tab==='overview'?<>A good day to<br/><em>learn something.</em></>:'Your library, curated.'}</h1><p className="intro-copy">{tab==='overview'?'Progress comes from showing up, not rushing through. Pick up where you left off.':'The playlists you have chosen to spend time with.'}</p></div>
        <div className="stats-strip">
          <article className="metric"><span className="metric-label">CURRENT STREAK <span className="metric-mark">↗</span></span><div className="metric-value">{currentStreak}<small>days</small></div><p>{currentStreak ? 'You have kept the habit going.' : 'Today is a good day to begin.'}</p></article>
          <article className="metric"><span className="metric-label">TIME TODAY <span className="metric-mark">◷</span></span><div className="metric-value">{totalMinutes}<small>min</small></div><p>Time spent with your lessons.</p></article>
          <article className="metric metric-highlight"><span className="metric-label">DAILY GOALS <span className="metric-mark">↗</span></span><div className="metric-value">{completedToday}<small>/{tracks.length}</small></div><p>Tracks at today's target.</p></article>
        </div>
        {tab==='overview'&&<div className="note-banner"><div className="note-symbol">✳</div><div><strong>Make a little progress.</strong><p>Even 15 focused minutes is better than waiting for the perfect time.</p></div><span className="banner-aside">TODAY'S NOTE</span></div>}
        <div className="library-heading"><div><p className="kicker">{tab==='overview'?'PICK UP WHERE YOU LEFT OFF':'ALL YOUR PLAYLISTS'}</p><h2>{tab==='overview'?'Your learning tracks':'Learning library'} <span className="count-chip">{tracks.length}</span></h2></div><div className="library-tools"><label className="search-box"><span>⌕</span><input aria-label="Search tracks" placeholder="Find a track" value={filter} onChange={e=>setFilter(e.target.value)}/></label><button className="button button-outline" onClick={()=>setOpen(true)}>＋ New track</button></div></div>
        {visibleTracks.length===0 ? <div className="empty-state"><div className="empty-art">l.</div><p className="kicker">{tracks.length?'NO MATCHES YET':'A FRESH PAGE'}</p><h3>{tracks.length?'Try another search.':'Your library starts here.'}</h3><p>{tracks.length?'There are no tracks matching that title.':'Bring in a YouTube playlist and turn it into a steady learning habit.'}</p>{!tracks.length&&<button className="button button-dark" onClick={()=>setOpen(true)}>Import your first playlist <span>↗</span></button>}</div> : <div className="track-grid">{visibleTracks.map((track,index)=><Track key={track.id} track={track} sessions={sessions} index={index} onOpen={()=>router.push(`/dashboard/track/${track.id}`)}/>)}</div>}
      </section>}
      <footer className="page-footer"><span>FIELDNOTES <span className="footer-dot">•</span> A SPACE TO KEEP LEARNING</span><span>ONE LESSON AT A TIME.</span></footer>
    </main>

    {open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setOpen(false);setImported(null);setError('')}}}><section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-topline"><span className="kicker">ADD TO YOUR LIBRARY</span><button className="icon-button modal-close" aria-label="Close dialog" onClick={()=>{setOpen(false);setImported(null);setError('')}}>×</button></div><h2 id="import-title">Bring your next<br/><em>lesson series in.</em></h2><p className="modal-description">Paste a public YouTube playlist link. We'll organise the lessons for you.</p><form onSubmit={e=>{e.preventDefault();void importPlaylist()}}><label className="field-label" htmlFor="playlist-url">PLAYLIST LINK</label><input id="playlist-url" className="field-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="youtube.com/playlist?list=..." type="url" required/><button className="button button-dark full-button" disabled={!url.trim()||busy}>{busy?'Fetching playlist…':'Preview playlist'} <span>↗</span></button></form>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {imported&&<div className="import-result">{imported.playlist.thumbnail_url&&<img src={imported.playlist.thumbnail_url} alt="" className="preview-image"/>}<div className="preview-title"><span className="kicker">PLAYLIST FOUND</span><h3>{imported.playlist.title}</h3><p>{imported.lessons.length} lessons ready to add</p></div><div className="goal-settings"><label>Daily target<select value={goalType} onChange={e=>setGoalType(e.target.value)}><option value="minutes">Minutes watched</option><option value="videos">Lessons completed</option></select></label><label>Target amount<input type="number" min="1" max="1440" value={goal} onChange={e=>setGoal(Number(e.target.value))}/></label></div><button className="button button-dark full-button" onClick={()=>void createTrack()} disabled={busy}>{busy?'Saving track…':'Add to my library'} <span>↗</span></button></div>}
      <p className="modal-footnote">Only public playlists can be imported. Your library stays private to your account.</p></section></div>}
  </div>
}

function Track({track,sessions,index,onOpen}:{track:any,sessions:any[],index:number,onOpen:()=>void}) {
  const relevant=sessions.filter(s=>s.track_id===track.id)
  const watched=completedLessonIds(track.lessons||[],relevant).size
  const total=track.lessons?.length||0
  const pct=total?Math.min(100,Math.round(watched/total*100)):0
  return <button className="track-card" onClick={onOpen}><div className="track-cover">{track.thumbnail_url?<img src={track.thumbnail_url} alt="" loading="lazy"/>:<div className="cover-placeholder"><span>l.</span></div>}<span className="cover-index">{String(index+1).padStart(2,'0')}</span><span className="cover-arrow">↗</span></div><div className="track-card-body"><div className="track-card-meta"><span>{total} LESSONS</span><span>{pct}%</span></div><h3>{track.title}</h3><p>{track.goal_type==='minutes'? `${track.daily_goal} minutes a day`:`${track.daily_goal} lessons a day`}</p><div className="progress-track"><span style={{width:`${pct}%`}}/></div><div className="track-card-foot"><span>{watched} of {total} completed</span><span>{pct===100?'FINISHED':'IN PROGRESS'}</span></div></div></button>
}
