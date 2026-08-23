const apiBase = import.meta.env.VITE_SERVICE_URL || '/api'
const token = () => localStorage.getItem('tce_access_token') || ''
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' })
const b64uToBytes = (value:string) => { const pad='='.repeat((4-value.length%4)%4); const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+pad); return Uint8Array.from(raw,c=>c.charCodeAt(0)) }
const bytesToB64u = (value:ArrayBuffer) => { const bytes=new Uint8Array(value); let raw=''; for(const b of bytes)raw+=String.fromCharCode(b); return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }
const json = async (path:string, init:RequestInit={}) => { const response=await fetch(`${apiBase}${path}`,{...init,headers:{...headers(),...(init.headers||{})}}); const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.message||'Authentication request failed'); return data }

export async function signInWithPasskey() {
  const options=await json('/auth/passkey/login/options',{method:'POST'})
  const credential=await navigator.credentials.get({publicKey:{...options,challenge:b64uToBytes(options.challenge).buffer,allowCredentials:(options.allowCredentials||[]).map((c:any)=>({...c,id:b64uToBytes(c.id).buffer}))}}) as PublicKeyCredential|null
  if(!credential)throw new Error('Passkey authentication was cancelled')
  const response=credential.response as AuthenticatorAssertionResponse
  return json('/auth/passkey/login/verify',{method:'POST',body:JSON.stringify({id:credential.id,rawId:bytesToB64u(credential.rawId),type:credential.type,response:{clientDataJSON:bytesToB64u(response.clientDataJSON),authenticatorData:bytesToB64u(response.authenticatorData),signature:bytesToB64u(response.signature),userHandle:response.userHandle?bytesToB64u(response.userHandle):null}})})
}

export async function registerPasskey() {
  const options=await json('/auth/passkey/register/options',{method:'POST'})
  const publicKey:any={...options,challenge:b64uToBytes(options.challenge).buffer,user:{...options.user,id:b64uToBytes(options.user.id).buffer},excludeCredentials:(options.excludeCredentials||[]).map((c:any)=>({...c,id:b64uToBytes(c.id).buffer}))}
  const credential=await navigator.credentials.create({publicKey}) as PublicKeyCredential|null
  if(!credential)throw new Error('Passkey registration was cancelled')
  const response=credential.response as AuthenticatorAttestationResponse
  return json('/auth/passkey/register/verify',{method:'POST',body:JSON.stringify({id:credential.id,rawId:bytesToB64u(credential.rawId),type:credential.type,response:{clientDataJSON:bytesToB64u(response.clientDataJSON),attestationObject:bytesToB64u(response.attestationObject)}})})
}
