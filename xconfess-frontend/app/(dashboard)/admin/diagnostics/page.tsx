'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/app/lib/api/client';

interface StellarConfig {
  network: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  contractIds: {
    confessionAnchor?: string;
    reputationBadges?: string;
    tippingSystem?: string;
  };
}

async function fetchStellarConfig(): Promise<StellarConfig> {
  const response = await apiClient.get('/stellar/config');
  return response.data;
}

function ConfigRow({ label, value, mono }: { label: string; value: string | undefined | null; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-48 shrink-0">
        {label}
      </dt>
      <dd className={`text-sm text-gray-900 dark:text-white break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-gray-400 italic">Not configured</span>}
      </dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      ))}
    </div>
  );
}

export default function DiagnosticsPage() {
  const { data: config, isLoading, error } = useQuery<StellarConfig>({
    queryKey: ['stellar', 'config'],
    queryFn: fetchStellarConfig,
    retry: 2,
    staleTime: 60000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Stellar Diagnostics
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Network and contract configuration for the Stellar integration
        </p>
      </div>

      {isLoading && <Skeleton />}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">
            Failed to load Stellar configuration. Ensure the backend is running and accessible.
          </p>
        </div>
      )}

      {config && (
        <div className="grid gap-6">
          {/* Network Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Network
            </h3>
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <ConfigRow label="Network" value={config.network} mono />
              <ConfigRow label="Horizon URL" value={config.horizonUrl} mono />
              <ConfigRow label="Soroban RPC URL" value={config.sorobanRpcUrl} mono />
            </dl>
          </div>

          {/* Contract IDs */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contract IDs
            </h3>
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <ConfigRow label="Confession Anchor" value={config.contractIds?.confessionAnchor} mono />
              <ConfigRow label="Reputation Badges" value={config.contractIds?.reputationBadges} mono />
              <ConfigRow label="Tipping System" value={config.contractIds?.tippingSystem} mono />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
