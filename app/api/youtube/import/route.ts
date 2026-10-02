import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPlaylistId,isoDurationToSeconds } from '@/lib/youtube'
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 const body=await req.json();const playlistId=extractPlaylistId(body.playlistUrl||'');if(!playlistId)return NextResponse.json({error:'Invalid YouTube playlist URL'},{status:400})
 const key=process.env.YOUTUBE_API_KEY;if(!key)return NextResponse.json({error:'YOUTUBE_API_KEY is not configured on Vercel'},{status:500})
 async function yt(path:string){const r=await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${encodeURIComponent(key)}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||'YouTube API error');return j}
 try{
  const meta=await yt(`playlists?part=snippet,contentDetails&id=${encodeURIComponent(playlistId)}`);if(!meta.items?.length)return NextResponse.json({error:'Playlist not found or not public'},{status:404})
  const playlist=meta.items[0];let page='';const items:any[]=[];
  do{const q=`playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50${page?`&pageToken=${encodeURIComponent(page)}`:''}`;const j=await yt(q);items.push(...(j.items||[]));page=j.nextPageToken||''}while(page)
  const ids=items.map(i=>i.contentDetails?.videoId).filter(Boolean);const videos:any[]=[];for(let i=0;i<ids.length;i+=50){const j=await yt(`videos?part=contentDetails,snippet&id=${ids.slice(i,i+50).join(',')}`);videos.push(...(j.items||[]))}
  const byId=new Map(videos.map(v=>[v.id,v]));
  const lessons=items.map((i,idx)=>{const v=byId.get(i.contentDetails.videoId);return {youtube_id:i.contentDetails.videoId,title:i.snippet?.title||v?.snippet?.title||`Lesson ${idx+1}`,duration_seconds:isoDurationToSeconds(v?.contentDetails?.duration||''),position:idx,thumbnail_url:v?.snippet?.thumbnails?.medium?.url||v?.snippet?.thumbnails?.default?.url||null}}).filter(x=>x.youtube_id)
  return NextResponse.json({playlist:{id:playlistId,title:playlist.snippet.title,description:playlist.snippet.description,thumbnail_url:playlist.snippet.thumbnails?.high?.url||playlist.snippet.thumbnails?.medium?.url||null},lessons})
 }catch(e:any){return NextResponse.json({error:e.message||'Import failed'},{status:500})}
}
