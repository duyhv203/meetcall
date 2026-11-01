import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Send,
  Video,
  MapPin,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';
import { useMatchStore } from '../../stores/matchStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { connectSocket } from '../../lib/socket.js';
import { resolvePhotoUrl } from '../../lib/api.js';
import type { ChatMessage } from '@meetcall/shared';

export function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { matches, fetchMatches } = useMatchStore();
  const {
    messages,
    isLoading,
    isLoadingMore,
    nextCursor,
    isPartnerTyping,
    isPartnerOnline,
    error,
    setActiveMatch,
    fetchInitialMessages,
    fetchMoreMessages,
    sendMessage,
    sendTyping,
    markAsRead,
    checkPartnerPresence,
    onMessageReceived,
    onTypingReceived,
    onReadReceived,
    resetChat,
  } = useChatStore();

  const [inputContent, setInputContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find partner info from matchStore
  const currentMatch = matches.find((m) => m.id === matchId);
  const partner = currentMatch?.partner;

  // Initial load
  useEffect(() => {
    if (!matchId) return;

    setActiveMatch(matchId);
    void fetchInitialMessages(matchId);
    void fetchMatches();

    const socket = connectSocket();

    const handleMessage = (msg: ChatMessage) => {
      onMessageReceived(msg);
      if (msg.senderId !== user?.id) {
        void markAsRead();
      }
    };

    const handleTyping = (data: { matchId: string; userId: string; isTyping: boolean }) => {
      onTypingReceived(data);
    };

    const handleRead = (data: { matchId: string; readBy: string; readAt: string }) => {
      onReadReceived(data);
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);

    // Initial read
    void markAsRead();

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      resetChat();
    };
  }, [
    matchId,
    setActiveMatch,
    fetchInitialMessages,
    fetchMatches,
    markAsRead,
    onMessageReceived,
    onTypingReceived,
    onReadReceived,
    resetChat,
    user?.id,
  ]);

  // Check presence periodically
  useEffect(() => {
    if (!partner?.id) return;
    void checkPartnerPresence(partner.id);

    const timer = setInterval(() => {
      void checkPartnerPresence(partner.id);
    }, 15000);

    return () => clearInterval(timer);
  }, [partner?.id, checkPartnerPresence]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputContent(e.target.value);
    sendTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 1500);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content || sending) return;

    setSending(true);
    sendTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const success = await sendMessage(content);
    if (success) {
      setInputContent('');
    }
    setSending(false);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/matches"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {partner ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                {partner.avatar ? (
                  <img
                    src={resolvePhotoUrl(partner.avatar)}
                    alt={partner.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-rose-400">
                    {partner.displayName[0]}
                  </div>
                )}
                {isPartnerOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">
                    {partner.displayName}, {partner.age}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  {isPartnerOnline ? (
                    <span className="text-emerald-400 font-medium">Đang trực tuyến</span>
                  ) : (
                    <span>Ngoại tuyến</span>
                  )}
                  {partner.city && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 text-rose-400" />
                        {partner.city}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-300">Cuộc trò chuyện</div>
          )}
        </div>

        {/* Video Call button for Step 6 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (matchId) {
                navigate(`/call/${matchId}`);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-xs font-semibold text-white transition shadow-md shadow-rose-500/20"
            title="Gọi video"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Gọi video</span>
          </button>
        </div>
      </header>

      {/* Messages Stream Container */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Load more button */}
        {nextCursor && (
          <div className="text-center py-2">
            <button
              type="button"
              onClick={() => void fetchMoreMessages()}
              disabled={isLoadingMore}
              className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
            >
              {isLoadingMore ? 'Đang tải tin nhắn cũ...' : 'Xem tin nhắn cũ hơn'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-2">
            <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
            <p className="text-xs">Hãy gửi lời chào đầu tiên để bắt đầu câu chuyện!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow ${
                    isMe
                      ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>

                {/* Timestamp & read receipts */}
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 px-1">
                  <span>{formatTime(msg.createdAt)}</span>
                  {isMe && (
                    <span title={msg.readAt ? 'Đã xem' : 'Đã gửi'}>
                      {msg.readAt ? (
                        <CheckCheck className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
            <div className="flex gap-1 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="text-[11px] italic">Đối phương đang soạn tin...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-950/70 border-t border-red-800 text-red-200 text-xs text-center">
          {error}
        </div>
      )}

      {/* Bottom Message Input Form */}
      <footer className="border-t border-slate-800 bg-slate-900/90 backdrop-blur-md p-3">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={inputContent}
            onChange={handleInputChange}
            placeholder="Nhập tin nhắn..."
            maxLength={2000}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500 transition"
          />

          <button
            type="submit"
            disabled={!inputContent.trim() || sending}
            className="p-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-md shadow-rose-500/20 transition disabled:opacity-50"
            title="Gửi"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
