'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

/** @deprecated Telegram configuration moved to /notifications. */
export default function TelegramBotConfig() {
  return (
    <div className="rounded-xl border border-violet-300/10 bg-violet-300/[0.04] p-4 text-sm text-zinc-400">
      <Bell className="mr-2 inline size-4 text-violet-300" />
      Telegram configuration has moved to the Notification Service.
      <Link href="/notifications" className="ml-2 text-violet-200 hover:text-white">
        Open Notification Service
      </Link>
    </div>
  );
}
