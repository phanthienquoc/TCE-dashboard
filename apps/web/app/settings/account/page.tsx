'use client';

import { LogOut, UserCircle } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';

export default function SettingsAccountPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view">
          <div className="tce-section-row">
            <div>
              <span className="tce-label">SETTINGS</span>
              <strong>Account</strong>
            </div>
            <UserCircle className="size-5" />
          </div>
          <section className="tce-settings-card">
            <div className="tce-row-card">
              <div>
                <strong>Account</strong>
                <span>Manage your signed-in account.</span>
              </div>
            </div>
            <button type="button" className="tce-row-card" disabled>
              <LogOut className="size-5" />
              <div>
                <strong>Logout</strong>
                <span>Sign out of TCE.</span>
              </div>
            </button>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
