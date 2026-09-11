'use client';

import { Users } from 'lucide-react';
import DashboardShell from '../../../components/dashboard/DashboardShell';

export default function SettingsUsersPage() {
  return (
    <DashboardShell view="settings">
      {() => (
        <div className="tce-mobile-view">
          <div className="tce-section-row">
            <div>
              <span className="tce-label">SETTINGS</span>
              <strong>User Management</strong>
            </div>
            <Users className="size-5" />
          </div>
          <section className="tce-settings-card">
            <div className="tce-row-card">
              <div>
                <strong>Users</strong>
                <span>Manage TCE users and access.</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
