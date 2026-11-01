import { Link } from 'react-router-dom';

export const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/settings"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Chính sách Quyền riêng tư (Privacy & GDPR)</h1>
            <p className="text-xs text-slate-400 mt-1">Cập nhật lần cuối: 01/11/2026</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Cam kết Bảo vệ Vị trí GPS (Nguyên tắc 5km)</h2>
            <p>
              Nhằm bảo vệ tuyệt đối nơi cư trú và an toàn thực tế của người dùng, MeetCall không bao giờ hiển thị tọa độ GPS chính xác cho người khác. Mọi khoảng cách hiển thị trên giao diện Khám phá luôn được làm tròn tối thiểu lên bội số 5 km gần nhất.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Xoá siêu dữ liệu hình ảnh (EXIF Stripping)</h2>
            <p>
              Khi bạn tải ảnh đại diện lên MeetCall, quy trình xử lý hình ảnh tự động loại bỏ hoàn toàn các siêu dữ liệu nhạy cảm (như EXIF GPS, thông số máy ảnh, thời gian chụp) trước khi lưu trữ và hiển thị cho cộng đồng.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Quyền của bạn theo GDPR (Data Portability)</h2>
            <p>
              Bạn có quyền yêu cầu xuất toàn bộ dữ liệu cá nhân (hồ sơ, hình ảnh, lịch sử tương hợp, tin nhắn gửi đi) dưới định dạng file JSON chuẩn hóa thông qua nút &quot;Tải xuống dữ liệu của tôi&quot; tại trang Cài đặt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Bảo mật WebRTC & Kết nối P2P</h2>
            <p>
              Các cuộc gọi video 1-1 và gọi ngẫu nhiên được truyền tải theo chuẩn mã hóa đầu cuối WebRTC P2P (DTLS-SRTP). Máy chủ MeetCall chỉ đóng vai trò chuyển tiếp tín hiệu (Signaling) và Relay TURN (khi gặp tường lửa NAT), không lưu trữ bất kỳ hình ảnh hay âm thanh cuộc gọi nào trên hệ thống.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
