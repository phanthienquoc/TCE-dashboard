'use client';
import { useState } from 'react';
import { platformApi } from '../../../lib/api';

type Credentials = { clientId:string; apiKey:string; apiSecret:string; accountNo:string; privateKey:string };

type Props = { onMessage:(v:string)=>void };

export default function SSIPlatform({ onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [environment, setEnvironment] = useState('production');
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [otp, setOtp] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [credentials, setCredentials] = useState<Credentials>({ clientId:'', apiKey:'', apiSecret:'', accountNo:'', privateKey:'' });

  const set = (key:keyof Credentials, value:string) => {
    setTested(false);
    setCredentials(current => ({ ...current, [key]: value }));
  };

  const messageFrom = (error: any) => error?.response?.data?.message ?? error?.message ?? 'Failed';

  const test = async () => {
    setBusy(true);
    try {
      const result = await platformApi.ssiTest({ environment, credentials, otp: otp || undefined, transactionId: transactionId || undefined });
      setTested(Boolean(result.data?.ok));
      if (result.data?.ok) onMessage('Test SSI: OK — credentials verified and ready to save');
      else onMessage(`Test SSI: ${result.data?.error?.message ?? 'Failed'}`);
    } catch (error) {
      setTested(false);
      onMessage(`Test SSI: ${messageFrom(error)}`);
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!tested) { onMessage('Save SSI: Test connection successfully before saving'); return; }
    setBusy(true);
    try {
      const result = await platformApi.ssiSaveTested({ environment, credentials, otp: otp || undefined, transactionId: transactionId || undefined });
      if (result.data?.ok) onMessage('Save SSI: OK');
      else onMessage(`Save SSI: ${result.data?.error?.message ?? 'Failed'}`);
    } catch (error) { onMessage(`Save SSI: ${messageFrom(error)}`); }
    finally { setBusy(false); }
  };

  const requestOtp = async () => {
    setBusy(true);
    try {
      const result = await platformApi.ssiOtp({ environment, credentials });
      setTransactionId(result.data?.data?.transactionId ?? result.data?.transactionId ?? '');
      onMessage('Request OTP: OK — enter OTP and test again');
    } catch (error) { onMessage(`Request OTP: ${messageFrom(error)}`); }
    finally { setBusy(false); }
  };

  const action = async (fn:()=>Promise<any>, name:string) => {
    setBusy(true);
    try { const result = await fn(); onMessage(`${name}: ${result.data?.ok === false ? result.data?.error?.message ?? 'Failed' : 'OK'}`); }
    catch (error) { onMessage(`${name}: ${messageFrom(error)}`); }
    finally { setBusy(false); }
  };

  return <div className="card">
    <div className="row"><h2>SSI FastConnect</h2><button onClick={()=>setOpen(v=>!v)}>{open?'Collapse':'Expand'}</button></div>
    {open && <>
      <div className="field"><label>Environment</label><select value={environment} onChange={e=>{setEnvironment(e.target.value);setTested(false)}}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></div>
      <div className="field">
        <input placeholder="Client ID" value={credentials.clientId} onChange={e=>set('clientId',e.target.value)}/>
        <input placeholder="API Key" value={credentials.apiKey} onChange={e=>set('apiKey',e.target.value)}/>
        <input placeholder="API Secret" type="password" value={credentials.apiSecret} onChange={e=>set('apiSecret',e.target.value)}/>
        <input placeholder="Account No." value={credentials.accountNo} onChange={e=>set('accountNo',e.target.value)}/>
        <input placeholder="Private Key" type="password" value={credentials.privateKey} onChange={e=>set('privateKey',e.target.value)}/>
        <input placeholder="OTP" value={otp} onChange={e=>{setOtp(e.target.value);setTested(false)}}/>
        <input placeholder="Transaction ID" value={transactionId} onChange={e=>{setTransactionId(e.target.value);setTested(false)}}/>
      </div>
      <div className="actions">
        <button disabled={busy} onClick={test}>Test Connection</button>
        <button disabled={busy} onClick={requestOtp}>Request OTP</button>
        <button disabled={busy || !tested} onClick={save}>Save</button>
        <button disabled={busy} onClick={()=>action(()=>platformApi.ssiCurrent({environment,otp:otp||undefined,transactionId:transactionId||undefined}),'Current')}>Current</button>
        <button disabled={busy} onClick={()=>action(()=>platformApi.ssiSync({environment,otp:otp||undefined,transactionId:transactionId||undefined}),'Sync')}>Sync</button>
      </div>
      <div className="muted">{tested ? 'Connection verified. Save is enabled.' : 'Test the current credentials before saving.'}</div>
    </>}
  </div>
}
