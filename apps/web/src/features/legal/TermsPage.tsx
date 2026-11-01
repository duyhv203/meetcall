import { Link } from 'react-router-dom';

export const TermsPage = () => {
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
            <h1 className="text-2xl font-bold text-white">Điều khoản Dịch vụ MeetCall</h1>
            <p className="text-xs text-slate-400 mt-1">Cập nhật lần cuối: 01/11/2026</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Yêu cầu độ tuổi 18+ nghiêm ngặt</h2>
            <p>
              MeetCall là nền tảng hẹn hò và gọi video trực tuyến dành riêng cho người trưởng thành từ đủ 18 tuổi trở lên. Chúng tôi nghiêm cấm mọi hành vi tạo tài khoản, đăng tải nội dung hoặc tiếp cận ứng dụng của người dưới 18 tuổi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Tiêu chuẩn cộng đồng & An toàn</h2>
            <p>
              Người dùng cam kết không thực hiện các hành vi sau trong quá trình sử dụng (bao gồm phòng trò chuyện văn bản và gọi video 1-1, gọi ngẫu nhiên):
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>Không khỏa thân, phát tán nội dung khiêu dâm hoặc gạ gẫm trái thuần phong mỹ tục.</li>
              <li>Không quấy rối, xúc phạm danh dự, phân biệt đối xử hoặc đe dọa người khác.</li>
              <li>Không lừa đảo tài chính, phát tán mã độc hoặc gửi spam / tin nhắn bán hàng.</li>
              <li>Tuyệt đối không có hành vi bóc lột hoặc gây hại đến trẻ vị thành niên. Mọi vi phạm liên quan đến trẻ vị thành niên sẽ bị báo cáo tới cơ quan thực thi pháp luật.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Quyền hạn của Quản trị viên</h2>
            <p>
              Hệ thống và ban quản trị có toàn quyền đình chỉ, khoá tài khoản tạm thời hoặc cấm vĩnh viễn không cần báo trước đối với bất kỳ tài khoản nào nhận từ 3 báo cáo vi phạm trở lên hoặc có hành vi gian dối độ tuổi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Xoá tài khoản & Thời gian ân hạn</h2>
            <p>
              Khi bạn yêu cầu xoá tài khoản, hệ thống sẽ thực hiện soft-delete và đưa vào thời gian ân hạn 7 ngày trước khi xoá vĩnh viễn toàn bộ dữ liệu khỏi hệ thống.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
