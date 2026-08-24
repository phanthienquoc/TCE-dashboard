'use client';

import { useEffect, useState } from 'react';
import styles from './ToastHost.module.css';

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail || {};
      const id = `${Date.now()}-${Math.random()}`;
      const toast = {
        id,
        type: detail.type || 'error',
        message: detail.message || 'API request failed.',
      };

      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 4500);
    };

    window.addEventListener('tce:toast', onToast);
    return () => window.removeEventListener('tce:toast', onToast);
  }, []);

  return (
    <div className={styles.host} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${toast.type === 'success' ? styles.success : styles.error}`} role="status">
          <span className={styles.icon}>{toast.type === 'success' ? '✓' : '!'}</span>
          <span className={styles.message}>{toast.message}</span>
          <button type="button" className={styles.close} onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Close notification">×</button>
        </div>
      ))}
    </div>
  );
}
