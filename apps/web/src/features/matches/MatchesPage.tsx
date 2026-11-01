import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  Heart,
  MessageCircle,
  Trash2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useMatchStore } from '../../stores/matchStore.js';
import { resolvePhotoUrl } from '../../lib/api.js';
import type { MatchItem } from '@meetcall/shared';

export function MatchesPage() {
  const navigate = useNavigate();
  const { matches, isLoading, error, fetchMatches, unmatch } = useMatchStore();
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<MatchItem | null>(null);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const handleConfirmUnmatch = async () => {
    if (!confirmMatch) return;
    setUnmatchingId(confirmMatch.id);
    await unmatch(confirmMatch.id);
    setUnmatchingId(null);
    setConfirmMatch(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-rose-500" />
            <h1 className="text-base font-bold">Danh sách tương hợp ({matches.length})</h1>
          </div>
        </div>

        <Link
          to="/discover"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-xs font-semibold text-white transition shadow-md shadow-rose-500/20"
        >
          <Compass className="w-4 h-4" />
          <span>Khám phá tiếp</span>
        </Link>
      </header>

      {/* Main Matches Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs text-center">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Đang tải danh sách tương hợp...</p>
          </div>
        ) : matches.length === 0 ? (
          /* Empty matches */
          <div className="max-w-md mx-auto my-12 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 fill-rose-500/20 text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-white">Chưa có ai tương hợp</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hãy tiếp tục quẹt và thích những hồ sơ bạn thấy ấn tượng. Khi cả hai cùng thích nhau, người đó sẽ xuất hiện ở đây!
            </p>
            <div className="pt-2">
              <Link
                to="/discover"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-xs font-semibold text-white transition shadow-md shadow-rose-500/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Bắt đầu quẹt ngay</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Matches Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {matches.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex gap-4 transition group"
              >
                {/* Partner Avatar */}
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
                  {item.partner.avatar ? (
                    <img
                      src={resolvePhotoUrl(item.partner.avatar)}
                      alt={item.partner.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-rose-400 font-bold text-xl">
                      {item.partner.displayName[0]}
                    </div>
                  )}
                </div>

                {/* Partner Info & Actions */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate">
                        {item.partner.displayName}, {item.partner.age}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setConfirmMatch(item)}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                        title="Huỷ tương hợp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      <span className="truncate">{item.partner.city || 'Chưa cập nhật'}</span>
                    </div>

                    {item.lastMessage ? (
                      <p className="text-xs text-rose-300 mt-1 truncate">
                        {item.lastMessage.content}
                      </p>
                    ) : item.partner.bio ? (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {item.partner.bio}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1 italic">
                        Đã match! Hãy gửi lời chào đầu tiên.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${item.id}`)}
                      className="flex-1 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Nhắn tin</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modal for Unmatching */}
      {confirmMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Huỷ tương hợp?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bạn có chắc chắn muốn huỷ tương hợp với{' '}
              <span className="text-white font-semibold">{confirmMatch.partner.displayName}</span>? Bạn sẽ không thể nhắn tin hoặc kết nối lại với người này nữa.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmMatch(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmUnmatch()}
                disabled={Boolean(unmatchingId)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {unmatchingId ? 'Đang huỷ...' : 'Huỷ tương hợp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
