import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Heart,
  MapPin,
  Save,
  Star,
  Trash2,
  Upload,
  User,
  Eye,
  X,
} from 'lucide-react';
import { useProfileStore } from '../../stores/profileStore.js';

const POPULAR_INTERESTS = [
  'Du lịch',
  'Âm nhạc',
  'Đọc sách',
  'Nấu ăn',
  'Thể thao',
  'Chơi game',
  'Cà phê',
  'Nghệ thuật',
  'Thú cưng',
  'Điện ảnh',
  'Công nghệ',
  'Nhiếp ảnh',
  'Chạy bộ',
  'Yoga',
];

export function ProfileSettingsPage() {
  const {
    me,
    fetchMe,
    updateProfile,
    updatePreferences,
    updateLocation,
    uploadPhoto,
    deletePhoto,
    reorderPhotos,
  } = useProfileStore();

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('male');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [city, setCity] = useState('');
  const [genderFilter, setGenderFilter] = useState<string[]>(['female']);
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(35);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  useEffect(() => {
    void fetchMe().then((data) => {
      if (data) {
        if (data.profile) {
          setDisplayName(data.profile.displayName || '');
          setGender(data.profile.gender || 'male');
          setBio(data.profile.bio || '');
          setInterests(data.profile.interests || []);
          setCity(data.profile.city || '');
        }
        if (data.preferences) {
          setGenderFilter(data.preferences.genderFilter);
          setMinAge(data.preferences.minAge);
          setMaxAge(data.preferences.maxAge);
          setMaxDistanceKm(data.preferences.maxDistanceKm);
        }
      }
    });
  }, [fetchMe]);

  const toggleInterest = (tag: string) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter((i) => i !== tag));
    } else {
      if (interests.length >= 10) return;
      setInterests([...interests, tag]);
    }
  };

  const addCustomTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed || interests.includes(trimmed)) return;
    if (interests.length >= 10) return;
    setInterests([...interests, trimmed]);
    setNewTag('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Chỉ hỗ trợ file ảnh JPG, PNG hoặc WebP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Dung lượng ảnh tối đa 8 MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg('');
      await uploadPhoto(file);
      setSuccessMsg('Đã tải ảnh lên thành công!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSetMainPhoto = async (photoId: string) => {
    if (!me?.photos) return;
    const currentIds = me.photos.map((p) => p.id);
    const reordered = [photoId, ...currentIds.filter((id) => id !== photoId)];
    await reorderPhotos(reordered);
  };

  const handleSaveAll = async () => {
    if (displayName.trim().length < 2 || displayName.trim().length > 30) {
      setErrorMsg('Tên hiển thị phải có từ 2 đến 30 ký tự');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);

    try {
      await updateProfile({
        displayName: displayName.trim(),
        gender,
        bio: bio.trim(),
        interests,
      });

      await updatePreferences({
        genderFilter,
        minAge: Math.max(18, minAge),
        maxAge: Math.max(minAge, maxAge),
        maxDistanceKm,
      });

      if (city) {
        await updateLocation({
          lat: 21.0285,
          lng: 105.8542,
          city: city.trim(),
        });
      }

      setSuccessMsg('Đã lưu tất cả thay đổi thành công!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (birthdate?: string) => {
    if (!birthdate) return 25;
    const birth = new Date(birthdate);
    const diffMs = Date.now() - birth.getTime();
    return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold">Cài đặt hồ sơ cá nhân</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Xem trước thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 font-semibold text-xs text-white shadow-md shadow-rose-500/20 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu lại'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-sm">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        {/* SECTION 1: Photos Management */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-rose-400" />
              <h2 className="font-semibold text-base">Hình ảnh hồ sơ</h2>
            </div>
            <span className="text-xs text-slate-400">
              {me?.photos?.length || 0} / 6 ảnh
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {(me?.photos || []).map((photo, idx) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-2xl overflow-hidden border border-slate-800 group bg-slate-950"
              >
                <img
                  src={photo.url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-rose-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                    <Star className="w-2.5 h-2.5 fill-white" />
                    Chính
                  </span>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void deletePhoto(photo.id)}
                      className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded transition"
                      title="Xoá ảnh"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => void handleSetMainPhoto(photo.id)}
                      className="w-full py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-white rounded transition text-center"
                    >
                      Đặt chính
                    </button>
                  )}
                </div>
              </div>
            ))}

            {(!me?.photos || me.photos.length < 6) && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-rose-500/80 flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleFileUpload(e)}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
                {uploadingPhoto ? (
                  <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-[11px] text-slate-400">Thêm ảnh</span>
                  </>
                )}
              </label>
            )}
          </div>
        </section>

        {/* SECTION 2: Profile Info */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-rose-400" />
            <h2 className="font-semibold text-base">Thông tin cá nhân</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Giới tính
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'male', label: 'Nam' },
                  { id: 'female', label: 'Nữ' },
                  { id: 'other', label: 'Khác' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGender(item.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                      gender === item.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Giới thiệu bản thân (Bio)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Chia sẻ về bạn..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 resize-none"
            />
            <div className="flex justify-end text-[11px] text-slate-500">
              {bio.length} / 300
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Sở thích
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {POPULAR_INTERESTS.map((tag) => {
                const selected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      selected
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Thêm sở thích riêng..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-xl text-slate-200"
              >
                Thêm
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 3: Discovery Preferences */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            <h2 className="font-semibold text-base">Tiêu chuẩn tìm kiếm & Vị trí</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Thành phố hiện tại
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Hà Nội, TP.HCM..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Bán kính tìm kiếm:</span>
              <span className="font-bold text-rose-400">{maxDistanceKm} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Độ tuổi mong muốn (tối thiểu 18):</span>
              <span className="font-bold text-rose-400">
                {minAge} - {maxAge} tuổi
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <input
                type="number"
                min="18"
                max={maxAge}
                value={minAge}
                onChange={(e) => setMinAge(Math.max(18, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <input
                type="number"
                min={minAge}
                max="100"
                value={maxAge}
                onChange={(e) => setMaxAge(Math.max(minAge, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </section>
      </main>

      {/* Profile Card Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Photo */}
            <div className="relative aspect-[3/4] bg-slate-950">
              {me?.photos?.[0]?.url ? (
                <img
                  src={me.photos[0].url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  Chưa có ảnh đại diện
                </div>
              )}

              {/* Gradient info overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-5">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-white">{displayName || 'MeetCaller'}</h3>
                  <span className="text-lg text-slate-300 font-medium">
                    {calculateAge(me?.profile.birthdate)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{city || 'Chưa cập nhật'} · Cách bạn ~5 km</span>
                </div>

                {bio && <p className="text-xs text-slate-300 mt-3 line-clamp-3">{bio}</p>}

                {interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {interests.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-white"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
