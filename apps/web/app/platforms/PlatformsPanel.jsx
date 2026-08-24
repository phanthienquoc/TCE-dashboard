'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
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

  useEffect(() => {
    api.get('/platform/credentials').then(({ data }) => {
      setSaved(Array.isArray(data) && data.some((item) => item.provider === 'ssi'));
    }).catch(() => {});
  }, []);

  const authBody = () => ({ environment, otp: otp || undefined, transactionId: transactionId || undefined });
  const message = (error, fallback) => error.response?.data?.message || error.message || fallback;

  async function save() {
    setBusy(true); setStatus('');
    try {
      if (!ssi.apiKey || !ssi.apiSecret || !ssi.accountNo) throw new Error('API Key, API Secret and Account No. are required.');
      await api.post('/platform/credentials/ssi', { environment, credentials: ssi });
      setSaved(true); setSsi({ ...emptySsi }); setStatus('SSI SDK v3 credentials saved securely.');
    } catch (error) { setStatus(message(error, 'Save failed.')); }
    finally { setBusy(false); }
  }

  async function requestOtp() {
    setBusy(true); setStatus('Requesting SSI OTP / Mobile Approval…');
    try {
      const { data } = await api.post('/platform/credentials/ssi/request-otp', { environment });
      const id = data?.data?.transactionId || data?.transactionId || '';
      if (id) setTransactionId(id);
      setStatus(id ? 'Approval requested. Approve in SSI/iBoard, then test connection.' : 'OTP / approval requested.');
    } catch (error) { setStatus(message(error, 'OTP request failed.')); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setStatus('Testing SSI SDK v3 connection…');
    try {
      const { data } = await api.post('/platform/credentials/ssi/test', authBody());
      const result = data?.data || data;
      setStatus(`Connected • API v${result.apiVersion || '3'} • market data OK • ${(result.accounts || []).length} account(s).`); setOtp('');
    } catch (error) { setStatus(message(error, 'Connection test failed.')); }
    finally { setBusy(false); }
  }

  async function loadCurrent() {
    setBusy(true); setStatus('Loading current SSI account information…');
    try {
      const { data } = await api.post('/platform/credentials/ssi/current', authBody());
      setCurrent(data?.data || data); setStatus('Current SSI information loaded.');
    } catch (error) { setStatus(message(error, 'Unable to load current info.')); }
    finally { setBusy(false); }
  }

  async function sync() {
    setBusy(true); setStatus('Syncing SSI portfolio…');
    try {
      const { data } = await api.post('/platform/credentials/ssi/sync', authBody());
      const result = data?.data || data; setStatus(`Synced • ${result.positionsSynced || 0} positions • ${result.ordersSynced || 0} orders.`);
    } catch (error) { setStatus(message(error, 'Portfolio sync failed.')); }
    finally { setBusy(false); }
  }

  const set = (key, value) => setSsi((valueState) => ({ ...valueState, [key]: value }));
  const button = (label, action, primary = false) => <button className={`${styles.button} ${primary ? styles.primary : ''}`} onClick={action} disabled={busy}>{label}</button>;

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
    <div className={styles.actions}>{button('Save credentials', save, true)}{button('Request OTP / Approval', requestOtp)}{button('Test connection', test)}{button('Get current info', loadCurrent)}{button('Sync portfolio', sync)}</div>
    <div className={styles.note}><b>Auth state</b><span>{transactionId ? `Transaction: ${transactionId}` : 'No active approval transaction'}{status ? ` • ${status}` : ''}</span></div>
    {current && <div className={styles.stats}><div className={styles.stat}><b>Accounts</b><strong>{current.accounts?.length || 0}</strong></div><div className={styles.stat}><b>Positions</b><strong>{current.positions?.length || 0}</strong></div><div className={styles.stat}><b>Orders</b><strong>{current.orders?.length || 0}</strong></div><pre className={styles.output}>{JSON.stringify(current, null, 2)}</pre></div>}
  </section>;
}
