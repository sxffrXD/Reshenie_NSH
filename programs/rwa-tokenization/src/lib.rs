"use client";

import { getUserTokens } from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet } from "../../hooks/useAnchorWallet";

/**
 * Страница "Мои инвестиции".
 * Исправлена ошибка 'publicKey is possibly null' путем явного сужения типов (type narrowing).
 */
export default function InvestmentsPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Явная проверка: если нет публичного ключа или кошелька Anchor, выходим
    if (!publicKey || !anchorWallet) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getUserTokens(connection, publicKey);
      setTokens(data);
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setLoading(false);
    }
  }, [anchorWallet, connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      void refresh();
    }
  }, [refresh, connected, publicKey]);

  // Если кошелек не подключен или publicKey отсутствует, показываем заглушку
  // Это гарантирует, что далее по коду publicKey не может быть null
  if (!connected || !publicKey) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Мои инвестиции</h1>
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl shadow-sm max-w-md">
          <p className="text-amber-700">Пожалуйста, подключите ваш кошелек Solana (например, Phantom) для доступа к портфелю активов.</p>
        </div>
      </div>
    );
  }

  // На этом этапе TypeScript понимает, что publicKey — это PublicKey, а не null
  const walletAddress = publicKey.toBase58();

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Мои инвестиции</h1>
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ваш адрес</span>
          <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 break-all">
            {walletAddress}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Активы в портфеле</h2>
        <button 
          type="button" 
          onClick={() => void refresh()} 
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-medium flex items-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Загрузка...
            </>
          ) : (
            "Обновить активы"
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
          <svg className="h-5 w-5 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {tokens.length === 0 && !loading ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 p-16 text-center rounded-2xl">
            <p className="text-slate-500 italic">На данный момент инвестиции не найдены в вашем кошельке.</p>
          </div>
        ) : (
          tokens.map((t, i) => (
            <div key={i} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Токен актива (Mint)</p>
                  <p className="font-mono text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 truncate group-hover:bg-white transition-colors">
                    {t.mint ? t.mint.toBase58() : "Неизвестный адрес"}
                  </p>
                </div>
                <div className="sm:text-right flex flex-col items-start sm:items-end">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Доля владения</p>
                  <p className="text-3xl font-black text-slate-900 leading-none">
                    {t.amount} <span className="text-sm font-normal text-slate-400">RWA</span>
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}