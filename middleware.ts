import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request})
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(cs)=>cs.forEach(({name,value})=>{request.cookies.set(name,value);response.cookies.set(name,value)})}})
 const {data:{user}}=await supabase.auth.getUser()
 const protectedPath=request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/api/')
 if(protectedPath&&!user){if(request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.redirect(new URL('/login',request.url))}
 return response
}
export const config={matcher:['/dashboard/:path*','/api/:path*']}
