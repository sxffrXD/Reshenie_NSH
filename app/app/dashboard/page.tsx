"use client";

import { getUserTokens } from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet } from "../../hooks/useAnchorWallet";

/**
 * Страница "Мои инвестиции".
 * Исправлена ошибка 'publicKey is possibly null' для прохождения сборки в Vercel.
 */
export default function InvestmentsPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  
  // Типизируем токены для предотвращения ошибок
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Безопасная проверка: если нет публичного ключа или кошелька Anchor, выходим
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

  // Если кошелек не подключен, показываем заглушку
  if (!connected || !publicKey) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Мои инвестиции</h1>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg inline-block">
          <p className="text-amber-700">Пожалуйста, подключите кошелек Phantom для просмотра ваших активов.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Мои инвестиции</h1>
        <p className="text-sm text-slate-500 mt-2 font-mono bg-slate-100 p-2 rounded break-all border">
          Кошелек: {publicKey.toBase58()}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button 
          type="button" 
          onClick={() => void refresh()} 
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-medium flex items-center gap-2"
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
            "Обновить"
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {tokens.length === 0 && !loading ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 p-12 text-center rounded-xl">
            <p className="text-slate-500">Инвестиции не найдены.</p>
          </div>
        ) : (
          tokens.map((t, i) => (
            <div key={i} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Токен актива</p>
                  <p className="font-mono text-sm text-slate-700 mt-1">{t.mint.toBase58()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Количество</p>
                  <p className="text-2xl font-bold text-slate-900">{t.amount}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}