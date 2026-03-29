"use client";

import { fetchAllAssets, getUserTokens } from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAnchorWallet } from "../../hooks/useAnchorWallet";

/**
 * Страница дашборда для отображения статистики пользователя и его RWA-активов.
 * Исправлена ошибка типизации publicKey для успешной сборки на Vercel.
 */
export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  
  const [listed, setListed] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Важно: проверяем наличие publicKey и anchorWallet перед запросом
    if (!publicKey || !anchorWallet) {
      setListed(null);
      setHoldings(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const [assets, tokens] = await Promise.all([
        fetchAllAssets(connection),
        getUserTokens(connection, publicKey),
      ]);
      setListed(assets.length);
      setHoldings(tokens.length);
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setLoading(false);
    }
  }, [anchorWallet, connection, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Заглушка, если кошелек не подключен
  if (!connected || !publicKey) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <div className="p-6 bg-slate-100 rounded-xl border border-dashed border-slate-300 text-center">
          <p className="text-slate-600">Подключите кошелек Phantom для просмотра вашей статистики.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Дашборд</h1>
        <p className="text-sm text-slate-500 font-mono mt-1 break-all bg-slate-50 p-2 rounded border">
          {publicKey.toBase58()}
        </p>
      </div>

      <div className="flex gap-2">
        <button 
          type="button" 
          onClick={() => void refresh()} 
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Обновление...
            </>
          ) : (
            "Обновить данные"
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">Проектов в сети</h3>
          <p className="text-3xl font-bold mt-2 text-slate-900">
            {listed ?? (loading ? "..." : "—")}
          </p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">Ваши RWA токены</h3>
          <p className="text-3xl font-bold mt-2 text-indigo-600">
            {holdings ?? (loading ? "..." : "—")}
          </p>
        </div>
      </div>

      <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-indigo-900 font-medium">Готовы расширить свой портфель?</p>
          <div className="flex gap-4">
            <Link href="/investments" className="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-4">
              Мои инвестиции →
            </Link>
            <Link href="/marketplace" className="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-4">
              Маркетплейс →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}