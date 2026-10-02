export function extractPlaylistId(input:string){try{const u=new URL(input);return u.searchParams.get('list')||null}catch{return input.trim()||null}}
export function isoDurationToSeconds(value:string){const m=value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);if(!m)return 0;return (Number(m[1]||0)*3600)+(Number(m[2]||0)*60)+Number(m[3]||0)}
