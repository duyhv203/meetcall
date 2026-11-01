import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BlockItemResponse } from '@meetcall/shared';

export const BlockedUsersPage = () => {
  const [blocks, setBlocks] = useState<BlockItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlockedUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/blocks');
      if (!res.ok) throw new Error('Không thể tải danh sách chặn');
      const data = await res.json();
      setBlocks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (blockedId: string) => {
    setUnblockingId(blockedId);
    try {
      const res = await fetch(`/api/v1/blocks/${blockedId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Không thể bỏ chặn');
      setBlocks((prev) => prev.filter((b) => b.blockedId !== blockedId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi bỏ chặn');
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/settings"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Danh sách người dùng đã chặn</h1>
            <p className="text-xs text-slate-400 mt-1">
              Những người này không thể liên lạc hoặc nhìn thấy hồ sơ của bạn.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-sm text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Đang tải danh sách...</div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8">
            <div className="text-4xl mb-3">🛡️</div>
            <h3 className="text-lg font-semibold text-slate-200">Không có ai bị chặn</h3>
            <p className="text-xs text-slate-400 mt-1">
              Danh sách chặn của bạn hiện đang trống.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                    {item.blockedUser.photoUrl ? (
                      <img
                        src={item.blockedUser.photoUrl}
                        alt={item.blockedUser.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                        No pic
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {item.blockedUser.displayName}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Đã chặn vào {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleUnblock(item.blockedId)}
                  disabled={unblockingId === item.blockedId}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition disabled:opacity-50"
                >
                  {unblockingId === item.blockedId ? 'Đang bỏ chặn...' : 'Bỏ chặn'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
