"use client";

import { getUserTokens } from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet } from "../../hooks/useAnchorWallet";

/**
 * Страница "Мои инвестиции".
 * Исправлена проверка publicKey для устранения ошибки сборки 'possibly null'.
 */
export default function InvestmentsPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Строгая проверка для предотвращения ошибок доступа к null
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

  // Ранний возврат, если кошелек не подключен или ключа нет
  if (!connected || !publicKey) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Мои инвестиции</h1>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg inline-block shadow-sm">
          <p className="text-amber-700">Пожалуйста, подключите кошелек Phantom для просмотра ваших активов.</p>
        </div>
      </div>
    );
  }

  // На этом этапе publicKey гарантированно существует
  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Мои инвестиции</h1>
        <p className="text-sm text-slate-500 mt-2 font-mono bg-slate-50 p-2 rounded break-all border border-slate-200">
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
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true"></span>
              Загрузка...
            </>
          ) : (
            "Обновить список"
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg animate-pulse">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {tokens.length === 0 && !loading ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 p-12 text-center rounded-xl">
            <p className="text-slate-500 italic">Инвестиции не найдены в этом кошельке.</p>
          </div>
        ) : (
          tokens.map((t, i) => (
            <div key={i} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Токен актива (Mint)</p>
                  <p className="font-mono text-sm text-slate-700 mt-1 select-all">{t.mint ? t.mint.toBase58() : "Неизвестно"}</p>
                </div>
                <div className="text-right sm:min-w-[120px]">
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