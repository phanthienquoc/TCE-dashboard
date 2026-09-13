'use client';

import type { PlatformConfigProps } from './types';
import SSIPlatform from '../../../app/components/platforms/SSIPlatform';

export default function SSIPlatformConfig({}: PlatformConfigProps) {
  return (
    <div className="ssi-credential-ui">
      <SSIPlatform />
      <style jsx global>{`
        /* Keep verification data attached to the success state instead of below the action stack. */
        .ssi-credential-ui section div:has(> div[class*='rounded-xl'][class*='text-slate-400']) {
          display: flex;
          flex-direction: column;
        }

        .ssi-credential-ui
          section
          div:has(> div[class*='rounded-xl'][class*='text-slate-400'])
          > div[class*='rounded-2xl'] {
          order: 0;
        }

        .ssi-credential-ui
          section
          div:has(> div[class*='rounded-xl'][class*='text-slate-400'])
          > div[class*='grid'] {
          order: 2;
        }

        .ssi-credential-ui
          section
          div:has(> div[class*='rounded-xl'][class*='text-slate-400'])
          > div[class*='rounded-xl'][class*='text-slate-400'] {
          order: 1;
          margin-top: -1rem;
          border-top: 0;
          border-radius: 0 0 0.75rem 0.75rem;
          padding-top: 0.5rem;
          padding-bottom: 0.625rem;
          background: rgba(52, 211, 153, 0.035);
        }

        /* Success/error feedback is transient; surface it as a compact toast. */
        .ssi-credential-ui section > div > div[class*='mt-4'][class*='rounded-2xl'] {
          position: fixed;
          z-index: 50;
          right: max(1rem, env(safe-area-inset-right));
          bottom: max(5.5rem, calc(env(safe-area-inset-bottom) + 4.75rem));
          width: min(28rem, calc(100vw - 2rem));
          margin-top: 0;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(14px);
        }

        @media (min-width: 640px) {
          .ssi-credential-ui section > div > div[class*='mt-4'][class*='rounded-2xl'] {
            right: 1.5rem;
            bottom: 1.5rem;
            width: min(28rem, calc(100vw - 3rem));
          }
        }
      `}</style>
    </div>
  );
}
