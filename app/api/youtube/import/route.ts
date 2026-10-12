import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPlaylistId, isoDurationToSeconds } from '@/lib/youtube'
export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_PLAYLIST_ITEMS=500, MAX_URL_LENGTH=2048, REQUEST_TIMEOUT_MS=10000
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 if(Number(req.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Request body too large'},{status:413})
 let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400})}
 if(!body||typeof body!=='object'||typeof body.playlistUrl!=='string')return NextResponse.json({error:'playlistUrl must be a string'},{status:400})
 const input=body.playlistUrl.trim();if(!input||input.length>MAX_URL_LENGTH)return NextResponse.json({error:'Playlist URL is empty or too long'},{status:400})
 const playlistId=extractPlaylistId(input);if(!playlistId)return NextResponse.json({error:'Invalid YouTube playlist URL or ID'},{status:400})
 const key=process.env.YOUTUBE_API_KEY;if(!key)return NextResponse.json({error:'Playlist import is temporarily unavailable'},{status:503})
 try{
  const {data:allowed,error:limitError}=await supabase.rpc('consume_playlist_import_limit',{p_user_id:user.id,p_limit:10,p_window_seconds:3600})
  if(limitError){console.error('Playlist import rate-limit check failed',limitError);return NextResponse.json({error:'Import service is temporarily unavailable'},{status:503})}
  if(!allowed)return NextResponse.json({error:'Import limit reached. Try again in an hour.'},{status:429})
  async function yt(path:string){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);try{const response=await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${encodeURIComponent(key)}`,{cache:'no-store',signal:controller.signal});const json=await response.json();if(!response.ok){const e=new Error('YouTube API request failed') as Error&{status?:number};e.status=response.status;throw e}return json}finally{clearTimeout(timeout)}}
  const meta=await yt(`playlists?part=snippet,contentDetails&id=${encodeURIComponent(playlistId)}`);if(!meta.items?.length)return NextResponse.json({error:'Playlist not found or not public'},{status:404})
  const playlist=meta.items[0];let page='',items:any[]=[]
  do{const result=await yt(`playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50${page?`&pageToken=${encodeURIComponent(page)}`:''}`);items.push(...(result.items||[]));page=result.nextPageToken||'';if(items.length>MAX_PLAYLIST_ITEMS||page&&items.length>=MAX_PLAYLIST_ITEMS)return NextResponse.json({error:`Playlist exceeds the ${MAX_PLAYLIST_ITEMS}-lesson import limit`},{status:413})}while(page)
  const ids=[...new Set(items.map((x:any)=>x.contentDetails?.videoId).filter((x:any)=>typeof x==='string'))];const videos:any[]=[]
  for(let i=0;i<ids.length;i+=50){const result=await yt(`videos?part=contentDetails,snippet&id=${ids.slice(i,i+50).map(encodeURIComponent).join(',')}`);videos.push(...(result.items||[]))}
  const byId=new Map(videos.map(v=>[v.id,v]));const lessons=items.map((item:any,index:number)=>{const videoId=item.contentDetails?.videoId;const video=byId.get(videoId);return {youtube_id:videoId,title:item.snippet?.title||video?.snippet?.title||`Lesson ${index+1}`,duration_seconds:isoDurationToSeconds(video?.contentDetails?.duration||''),position:index,thumbnail_url:video?.snippet?.thumbnails?.medium?.url||video?.snippet?.thumbnails?.default?.url||null}}).filter((x:any)=>typeof x.youtube_id==='string')
  return NextResponse.json({playlist:{id:playlistId,title:playlist.snippet.title,description:playlist.snippet.description,thumbnail_url:playlist.snippet.thumbnails?.high?.url||playlist.snippet.thumbnails?.medium?.url||null},lessons})
 }catch(error:any){if(error?.name==='AbortError')return NextResponse.json({error:'YouTube API timed out. Please retry.'},{status:504});console.error('YouTube playlist import failed',{userId:user.id,message:error?.message,status:error?.status});return NextResponse.json({error:'Playlist import failed. Check the URL and try again.'},{status:502})}
}