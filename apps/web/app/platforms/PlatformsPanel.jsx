'use client';

import { useEffect, useState } from 'react';
import {
  getCurrentSsiInfo,
  hasSsiCredentials,
  requestSsiOtp,
  saveSsiCredentials,
  syncSsiPortfolio,
  testSsiConnection,
} from '../../services/platform';
import styles from './PlatformsPanel.module.css';

const emptySsi = { clientId: '', apiKey: '', apiSecret: '', privateKey: '', accountNo: '' };

export default function PlatformsPanel() {
  const [saved, setSaved] = useState(false);
  const [ssi, setSsi] = useState(emptySsi);
  const [environment, setEnvironment] = useState('production');
  const [otp, setOtp] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [status, setStatus] = useState('');
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    let active = true;
    setCurrent(null);
    setTransactionId('');
    setStatus('');
    hasSsiCredentials(environment).then((value) => active && setSaved(value)).catch(() => active && setSaved(false));
    return () => { active = false; };
  }, [environment]);

  const authBody = () => ({ environment, otp: otp || undefined, transactionId: transactionId || undefined });
  const credentialBody = () => ({ ...ssi });
  const message = (error, fallback) => error.response?.data?.message || error.message || fallback;

  async function save() {
    setBusy(true); setBusyAction('save'); setStatus('Saving SSI credentials…');
    try {
      if (!ssi.apiKey || !ssi.apiSecret || !ssi.accountNo) {
        throw new Error('API Key, API Secret and Account No. are required.');
      }
      await saveSsiCredentials(environment, credentialBody());
      setSaved(true);
      setStatus('Credentials saved successfully.');
    } catch (error) { setStatus(message(error, 'Unable to save credentials.')); }
    finally { setBusy(false); setBusyAction(''); }
  }

  async function requestOtp() {
    setBusy(true); setBusyAction('otp'); setStatus('Requesting SSI OTP / Mobile Approval…');
    try {
      const data = await requestSsiOtp({ environment, credentials: credentialBody() });
      const id = data?.data?.transactionId || data?.transactionId || '';
      if (id) setTransactionId(id);
      setStatus(id ? 'Approval requested. Approve in SSI/iBoard, then test connection.' : 'OTP / approval requested.');
    } catch (error) { setStatus(message(error, 'OTP request failed.')); }
    finally { setBusy(false); setBusyAction(''); }
  }

  async function test() {
    setBusy(true); setBusyAction('test'); setStatus('Testing SSI SDK v3 connection…');
    try {
      if (!ssi.apiKey || !ssi.apiSecret || !ssi.accountNo) {
        throw new Error('API Key, API Secret and Account No. are required.');
      }
      const result = await testSsiConnection({ ...authBody(), credentials: credentialBody() });
      setStatus(`Connection successful • API v${result.apiVersion || '3'} • market data OK • ${(result.accounts || []).length} account(s).`);
    } catch (error) { setStatus(message(error, 'Connection test failed.')); }
    finally { setBusy(false); setBusyAction(''); }
  }

  async function loadCurrent() {
    setBusy(true); setBusyAction('current'); setStatus('Loading current SSI account information…');
    try {
      const result = await getCurrentSsiInfo(authBody());
      setCurrent(result); setStatus('Current SSI information loaded.');
    } catch (error) { setStatus(message(error, 'Unable to load current info.')); }
    finally { setBusy(false); setBusyAction(''); }
  }

  async function sync() {
    setBusy(true); setBusyAction('sync'); setStatus('Syncing SSI portfolio…');
    try {
      const result = await syncSsiPortfolio(authBody());
      setStatus(`Synced • ${result.positionsSynced || 0} positions • ${result.ordersSynced || 0} orders.`);
    } catch (error) { setStatus(message(error, 'Portfolio sync failed.')); }
    finally { setBusy(false); setBusyAction(''); }
  }

  const set = (key, value) => setSsi((valueState) => ({ ...valueState, [key]: value }));
  const button = (label, action, primary = false, actionName = '') => (
    <button className={`${styles.button} ${primary ? styles.primary : ''}`} onClick={action} disabled={busy}>
      {busy && busyAction === actionName ? 'Working…' : label}
    </button>
  );

  return <section className={`section page-section ${styles.page}`}>
    <div className={styles.head}><div><span className="eyebrow">PLATFORM CONFIG</span><h2>SSI FastConnect</h2><small>SSI SDK v3 • credentials stay server-side and are never returned.</small></div><span className={`${styles.status} ${saved ? styles.statusOk : ''}`}>{saved ? '● CONFIGURED' : '○ NOT CONFIGURED'}</span></div>
    <div className={styles.fields}>
      <label className={styles.field}>Environment<select className={styles.select} value={environment} onChange={(e) => setEnvironment(e.target.value)}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label>
      <label className={styles.field}>Client ID<input className={styles.input} value={ssi.clientId} onChange={(e) => set('clientId', e.target.value)} placeholder="SSI Client ID" autoComplete="off" /></label>
      <label className={styles.field}>API Key<input className={styles.input} type="password" value={ssi.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="SSI API Key" autoComplete="off" /></label>
      <label className={styles.field}>API Secret<input className={styles.input} type="password" value={ssi.apiSecret} onChange={(e) => set('apiSecret', e.target.value)} placeholder="SSI API Secret" autoComplete="off" /></label>
      <label className={styles.field}>Account No.<input className={styles.input} value={ssi.accountNo} onChange={(e) => set('accountNo', e.target.value)} placeholder="SSI account number" inputMode="numeric" /></label>
      <label className={styles.field}>OTP<input className={styles.input} type="password" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Optional SmartOTP" inputMode="numeric" autoComplete="one-time-code" /></label>
    </div>
    <label className={styles.field}>Private Key<textarea className={styles.textarea} value={ssi.privateKey} onChange={(e) => set('privateKey', e.target.value)} rows={4} placeholder="SSI SDK v3 private key" autoComplete="off" /></label>
    <div className={styles.actions}>
      {button('Save', save, true, 'save')}
      {button('Test connection', test, false, 'test')}
      {button('Request OTP / Approval', requestOtp, false, 'otp')}
      {button('Get current info', loadCurrent, false, 'current')}
      {button('Sync portfolio', sync, false, 'sync')}
    </div>
    <div className={styles.note}><b>Auth state</b><span>{transactionId ? `Transaction: ${transactionId}` : 'No active approval transaction'}{status ? ` • ${status}` : ''}</span></div>
    {current && <div className={styles.stats}><div className={styles.stat}><b>Accounts</b><strong>{current.accounts?.length || 0}</strong></div><div className={styles.stat}><b>Positions</b><strong>{current.positions?.length || 0}</strong></div><div className={styles.stat}><b>Orders</b><strong>{current.orders?.length || 0}</strong></div><pre className={styles.output}>{JSON.stringify(current, null, 2)}</pre></div>}
  </section>;
}
