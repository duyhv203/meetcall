import React, { useState } from 'react';

interface BlockButtonProps {
  targetId: string;
  targetName?: string;
  onBlocked?: () => void;
  className?: string;
}

export const BlockButton: React.FC<BlockButtonProps> = ({
  targetId,
  targetName,
  onBlocked,
  className = '',
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedId: targetId }),
      });

      if (res.ok) {
        setShowConfirm(false);
        if (onBlocked) onBlocked();
      } else {
        const err = await res.json();
        alert(err?.error?.message || 'Không thể chặn người dùng');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={`text-slate-400 hover:text-rose-400 text-xs transition ${className}`}
        title="Chặn người dùng này"
      >
        Chặn
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Chặn {targetName || 'người này'}?
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Hai bạn sẽ không còn thấy nhau trên Khám phá, không thể nhắn tin hoặc gọi video cho nhau. Mọi tương hợp giữa hai người sẽ bị huỷ bỏ ngay lập tức.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Huỷ
              </button>
              <button
                onClick={handleBlock}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
              >
                {loading ? 'Đang chặn...' : 'Xác nhận Chặn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
