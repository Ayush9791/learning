import './globals.css'
export const metadata={title:{default:'Fieldnotes · Learning Studio',template:'%s · Fieldnotes'},description:'A quieter space to organise your learning, build a steady habit, and keep track of what you watch.'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
