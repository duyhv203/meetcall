import React, { useState } from 'react';
import type { ReportReasonType } from '@meetcall/shared';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName?: string;
  callId?: string;
  onReported?: () => void;
}

const REASONS: Array<{ value: ReportReasonType; label: string; description: string; urgent?: boolean }> = [
  {
    value: 'minor',
    label: 'Nghi ngờ dưới 18 tuổi',
    description: 'Người dùng có dấu hiệu là trẻ vị thành niên (Ưu tiên xử lý ngay)',
    urgent: true,
  },
  {
    value: 'nudity',
    label: 'Ảnh khoả thân / Khiêu dâm',
    description: 'Hành vi hoặc hình ảnh hở hang, khêu gợi không phù hợp',
  },
  {
    value: 'harassment',
    label: 'Quấy rối / Đe dọa',
    description: 'Tin nhắn hoặc lời nói thô lỗ, đe dọa, xúc phạm danh dự',
  },
  {
    value: 'scam',
    label: 'Lừa đảo tài chính',
    description: 'Yêu cầu chuyển tiền, thẻ cào, đầu tư tài chính lừa đảo',
  },
  {
    value: 'spam',
    label: 'Spam / Bán hàng',
    description: 'Gửi link quảng cáo, rủ rê mua bán hoặc dịch vụ',
  },
  {
    value: 'other',
    label: 'Lý do khác',
    description: 'Vi phạm các tiêu chuẩn cộng đồng khác',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetName,
  callId,
  onReported,
}) => {
  const [reason, setReason] = useState<ReportReasonType>('harassment');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          reason,
          details: details.trim() || undefined,
          callId: callId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Không thể gửi báo cáo');
      }

      setSubmitted(true);
      if (onReported) onReported();
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Đã gửi báo cáo</h3>
            <p className="text-slate-400 text-sm">
              Cảm ơn bạn đã chung tay bảo vệ an toàn cho cộng đồng MeetCall.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Báo cáo vi phạm {targetName ? `"${targetName}"` : ''}
                </h3>
                <p className="text-xs text-slate-400">
                  Báo cáo được bảo mật hoàn toàn và chuyển tới ban quản trị 24/7.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-300 block">Lý do báo cáo</label>
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    reason === r.value
                      ? 'border-rose-500 bg-rose-500/10'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="mt-1 text-rose-500 focus:ring-rose-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{r.label}</span>
                      {r.urgent && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-rose-600 text-white rounded font-bold uppercase">
                          Ưu tiên
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mb-6">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Chi tiết bổ sung (không bắt buộc)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Mô tả cụ thể hành vi vi phạm để giúp ban quản trị xử lý nhanh hơn..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white"
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
              >
                {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
