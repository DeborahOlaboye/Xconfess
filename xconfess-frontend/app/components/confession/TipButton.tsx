"use client";

import { useState, useEffect } from "react";
import {
  sendTip,
  verifyTip,
  getTipStats,
  type TipStats,
} from "@/lib/services/tipping.service";
import { useWallet } from "@/lib/hooks/useWallet";
import { getWalletCTAState } from "@/lib/hooks/useWalletCTAState";
import { useActivityStore } from "@/app/lib/store/activity.store";
import { v4 as uuidv4 } from "uuid";

const STELLAR_EXPLORER_URL =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

const MIN_TIP_AMOUNT = 0.1;

interface TipButtonProps {
  confessionId: string;
  recipientAddress?: string;
  initialStats?: TipStats;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export const TipButton = ({
  confessionId,
  recipientAddress,
  initialStats,
}: TipButtonProps) => {
  const addActivity = useActivityStore((s) => s.addActivity);
  const updateActivity = useActivityStore((s) => s.updateActivity);

  const [isOpen, setIsOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(String(MIN_TIP_AMOUNT));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedTx, setConfirmedTx] = useState<{ hash: string; amount: number } | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [stats, setStats] = useState<TipStats | null>(initialStats || null);

  const wallet = useWallet();
  const { isConnected, connect } = wallet;
  const walletCTA = getWalletCTAState(wallet, { extraDisabled: isSending });

  useEffect(() => {
    const fetchStats = async () => {
      const tipStats = await getTipStats(confessionId);
      if (tipStats) setStats(tipStats);
    };
    fetchStats();
  }, [confessionId]);

  const refreshStats = async () => {
    const updated = await getTipStats(confessionId);
    if (updated) setStats(updated);
  };

  const handleTip = async () => {
    if (isSending) return;

    if (!recipientAddress) {
      setError("Recipient address not available");
      return;
    }

    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount < MIN_TIP_AMOUNT) {
      setError(`Minimum tip is ${MIN_TIP_AMOUNT} XLM`);
      return;
    }

    if (!isConnected) {
      try {
        await connect();
      } catch {
        setError("Connect your wallet");
        return;
      }
    }

    setIsSending(true);
    setError(null);
    setConfirmedTx(null);

    const activityId = uuidv4();
    addActivity({
      id: activityId,
      type: "tip",
      status: "submitted",
      createdAt: Date.now(),
      confessionId,
      amount,
    });

    try {
      const result = await sendTip(confessionId, amount, recipientAddress);

      if (!result.success || !result.txHash) {
        throw new Error(result.error || "Failed to send tip");
      }

      updateActivity(activityId, { txHash: result.txHash });

      const verifyResult = await verifyTip(confessionId, result.txHash);

      if (!verifyResult.success) {
        setPendingTxHash(result.txHash);

        updateActivity(activityId, {
          status: "submitted",
          updatedAt: Date.now(),
        });

        return;
      }

      updateActivity(activityId, {
        status: "confirmed",
        updatedAt: Date.now(),
      });

      setConfirmedTx({ hash: result.txHash, amount });
      setTipAmount(String(MIN_TIP_AMOUNT));
      setPendingTxHash(null);
      await refreshStats();
    } catch (err: any) {
      updateActivity(activityId, {
        status: "failed",
        updatedAt: Date.now(),
      });

      if (err.message === "Verification pending") {
        setError(
          "Transaction submitted but verification is taking longer than expected. " +
          "You can retry verification below.",
        );
      } else {
        setError(err.message || "Failed to send tip");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (isSending || !pendingTxHash) return;

    setIsSending(true);
    setError(null);

    try {
      const verifyResult = await verifyTip(confessionId, pendingTxHash);

      if (!verifyResult.success) {
        throw new Error("Verification still pending");
      }

      setConfirmedTx({ hash: pendingTxHash, amount: parseFloat(tipAmount) });
      setPendingTxHash(null);
      await refreshStats();
    } catch (err: any) {
      setError(
        "Verification not yet confirmed. The transaction may still be processing on the Stellar network. " +
        "Please wait a moment and try again, or check the explorer link below.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const totalAmount = stats?.totalAmount || 0;
  const tipCount = stats?.totalCount || 0;

  const explorerUrl = pendingTxHash
    ? `${STELLAR_EXPLORER_URL}/${pendingTxHash}`
    : confirmedTx
      ? `${STELLAR_EXPLORER_URL}/${confirmedTx.hash}`
      : null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!recipientAddress}
        aria-label="Tip confession"
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-opacity"
      >
        <span className="text-lg">💰</span>
        {tipCount > 0 && (
          <span className="text-sm font-medium text-white">{tipCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-800 p-4 rounded-xl shadow-xl z-50">
          <h3 className="text-white font-semibold mb-3">Send Tip</h3>

          {/* Confirmed state */}
          {confirmedTx && (
            <div className="mb-3 p-3 rounded-lg bg-green-900/30 border border-green-700/50">
              <div className="flex items-center gap-2 text-green-400 font-medium text-sm">
                <span>✓</span>
                <span>Tip confirmed</span>
              </div>
              <p className="text-green-300 text-xs mt-1">
                {confirmedTx.amount} XLM sent
              </p>
              {confirmedTx.hash && (
                <a
                  href={`${STELLAR_EXPLORER_URL}/${confirmedTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 text-xs text-green-400 underline hover:text-green-300 truncate"
                >
                  View transaction →
                </a>
              )}
            </div>
          )}

          {/* Pending verification state */}
          {pendingTxHash && (
            <div className="mb-3 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50">
              <div className="flex items-center gap-2 text-yellow-400 font-medium text-sm">
                <Spinner />
                <span>Verifying transaction</span>
              </div>
              <p className="text-yellow-300 text-xs mt-1">
                Checking Stellar network confirmation status
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleVerify}
                  disabled={isSending}
                  className="flex-1 text-xs bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 py-1.5 rounded text-white transition-colors"
                >
                  {isSending ? "Checking..." : "Retry Verification"}
                </button>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 py-1.5 px-2 rounded text-zinc-300 transition-colors"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !pendingTxHash && !confirmedTx && (
            <div className="mb-3 p-3 rounded-lg bg-red-900/30 border border-red-700/50">
              <p className="text-red-400 text-xs">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-300 underline hover:text-red-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Input */}
          {!confirmedTx && (
            <>
              <div className="relative">
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  min={MIN_TIP_AMOUNT}
                  step="0.1"
                  disabled={isSending}
                  className="w-full p-2 pr-12 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  aria-label="Tip amount in XLM"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
                  XLM
                </span>
              </div>

              {walletCTA.status === "not-installed" && (
                <div className="text-xs text-yellow-400 mt-2">
                  {walletCTA.guidance}
                </div>
              )}

              <button
                onClick={handleTip}
                disabled={walletCTA.disabled || isSending}
                className="w-full mt-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                aria-label={
                  isSending
                    ? "Sending tip"
                    : walletCTA.status === "not-connected"
                      ? "Connect Wallet to Tip"
                      : `Send ${tipAmount} XLM tip`
                }
              >
                {isSending ? (
                  <>
                    <Spinner />
                    <span>Sending...</span>
                  </>
                ) : walletCTA.status === "not-connected" ? (
                  "Connect Wallet to Tip"
                ) : (
                  `Tip ${tipAmount} XLM`
                )}
              </button>

              {walletCTA.status === "not-ready" && (
                <div className="text-xs text-orange-400 mt-2">
                  {walletCTA.guidance}
                </div>
              )}
            </>
          )}

          {/* Stats footer */}
          <div className="text-xs text-zinc-500 mt-3 pt-2 border-t border-zinc-700">
            {totalAmount.toFixed(2)} XLM total • {tipCount} tip{tipCount !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
};