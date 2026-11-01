import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  User,
  Heart,
  Camera,
  MapPin,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Star,
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

export function OnboardingPage() {
  const navigate = useNavigate();
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

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Step 1: Basic Info
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('male');

  // Step 2: Bio & Interests
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Step 3: Photos (managed from me.photos)
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 4: Preferences & Location
  const [city, setCity] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [genderFilter, setGenderFilter] = useState<string[]>(['female']);
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(35);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  useEffect(() => {
    void fetchMe().then((data) => {
      if (data) {
        if (data.onboardingCompleted) {
          navigate('/', { replace: true });
          return;
        }
        if (data.profile) {
          setDisplayName(data.profile.displayName || '');
          setGender(data.profile.gender || 'male');
          setBio(data.profile.bio || '');
          setInterests(data.profile.interests || []);
          setCity(data.profile.city || '');
        }
        if (data.preferences) {
          setGenderFilter(
            data.preferences.genderFilter.length > 0 ? data.preferences.genderFilter : ['female'],
          );
          setMinAge(data.preferences.minAge >= 18 ? data.preferences.minAge : 18);
          setMaxAge(data.preferences.maxAge || 35);
          setMaxDistanceKm(data.preferences.maxDistanceKm || 50);
        }
      }
    });
  }, [fetchMe, navigate]);

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
      setErrorMsg('Dung lượng ảnh không được vượt quá 8 MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg('');
      await uploadPhoto(file);
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }
    setIsGettingLocation(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (!city) {
          setCity('Vị trí hiện tại');
        }
        setIsGettingLocation(false);
      },
      (err) => {
        setErrorMsg('Không thể lấy vị trí GPS: ' + err.message);
        setIsGettingLocation(false);
      },
      { timeout: 10000 },
    );
  };

  const handleStep1Submit = async () => {
    if (displayName.trim().length < 2 || displayName.trim().length > 30) {
      setErrorMsg('Tên hiển thị phải có từ 2 đến 30 ký tự');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      await updateProfile({ displayName: displayName.trim(), gender });
      setStep(2);
    } catch (err: unknown) {
      setErrorMsg(
        (err as any)?.message ||
          (err as any)?.error?.message ||
          'Lỗi khi lưu thông tin',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await updateProfile({ bio: bio.trim(), interests });
      setStep(3);
    } catch (err: unknown) {
      setErrorMsg(
        (err as any)?.message ||
          (err as any)?.error?.message ||
          'Lỗi khi lưu sở thích',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = () => {
    if (!me?.photos || me.photos.length === 0) {
      setErrorMsg('Vui lòng tải lên ít nhất 1 ảnh đại diện để tiếp tục');
      return;
    }
    setErrorMsg('');
    setStep(4);
  };

  const handleStep4Finish = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      // 1. Update preferences
      await updatePreferences({
        genderFilter,
        minAge: Math.max(18, minAge),
        maxAge: Math.max(minAge, maxAge),
        maxDistanceKm,
      });

      // 2. Update location if GPS coords available or fallback coordinates
      const finalLat = gpsCoords?.lat ?? 21.0285; // Default Hanoi if location denied
      const finalLng = gpsCoords?.lng ?? 105.8542;
      await updateLocation({
        lat: finalLat,
        lng: finalLng,
        city: city.trim() || 'Hà Nội',
      });

      const updatedMe = await fetchMe();
      if (updatedMe?.onboardingCompleted) {
        navigate('/', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      setErrorMsg(
        (err as any)?.message ||
          (err as any)?.error?.message ||
          'Lỗi khi hoàn tất hồ sơ',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center py-12 px-4">
      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        {/* Progress header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-rose-500 animate-pulse" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                Hoàn tất hồ sơ MeetCall
              </h1>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
              Bước {step} / 4
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-orange-500 h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Name & Gender */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <User className="w-5 h-5 text-rose-400" />
              <span>Thông tin cơ bản</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tên hiển thị của bạn
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                placeholder="VD: Tuấn Anh, Lan Hương..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition"
              />
              <p className="text-xs text-slate-500 mt-1">Từ 2 đến 30 ký tự, hiển thị trên thẻ hồ sơ.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Giới tính của bạn
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'male', label: 'Nam' },
                  { id: 'female', label: 'Nữ' },
                  { id: 'other', label: 'Khác' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGender(item.id)}
                    className={`py-3 px-4 rounded-xl border font-medium text-sm transition text-center ${
                      gender === item.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleStep1Submit()}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 px-6 py-3 rounded-xl font-semibold text-white shadow-lg shadow-rose-500/25 transition disabled:opacity-50"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Bio & Interests */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <Heart className="w-5 h-5 text-rose-400" />
              <span>Giới thiệu & Sở thích</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Giới thiệu bản thân (Bio)
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Chia sẻ đôi nét về bạn, sở thích hoặc điều bạn tìm kiếm..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition resize-none"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Ngắn gọn và thu hút người khác</span>
                <span>{bio.length} / 300</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sở thích của bạn (chọn tối đa 10)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {POPULAR_INTERESTS.map((item) => {
                  const selected = interests.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        selected
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-medium'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              {/* Add custom tag */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Thêm sở thích khác..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl text-slate-200 transition"
                >
                  Thêm
                </button>
              </div>

              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {interests.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => toggleInterest(tag)}
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                onClick={() => void handleStep2Submit()}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 px-6 py-2.5 rounded-xl font-semibold text-white shadow-lg shadow-rose-500/25 transition disabled:opacity-50"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Photo Upload */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <Camera className="w-5 h-5 text-rose-400" />
              <span>Ảnh đại diện</span>
            </div>

            <p className="text-sm text-slate-400">
              Tải lên ít nhất 1 ảnh rõ mặt của bạn. Ảnh đầu tiên sẽ là ảnh đại diện chính được hiển thị khi người khác khám phá.
            </p>

            {/* Photos grid */}
            <div className="grid grid-cols-3 gap-3">
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
                    <span className="absolute top-2 left-2 bg-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Star className="w-3 h-3 fill-white" />
                      Chính
                    </span>
                  )}

                  {/* Overlay buttons */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void deletePhoto(photo.id)}
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition"
                        title="Xoá ảnh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => void handleSetMainPhoto(photo.id)}
                        className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg transition text-center"
                      >
                        Đặt làm ảnh chính
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Upload button box */}
              {(!me?.photos || me.photos.length < 6) && (
                <label className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-rose-500/80 flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/50 hover:bg-slate-950">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handleFileUpload(e)}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-400 font-medium">Thêm ảnh</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                onClick={handleStep3Submit}
                disabled={!me?.photos || me.photos.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 px-6 py-2.5 rounded-xl font-semibold text-white shadow-lg shadow-rose-500/25 transition disabled:opacity-50"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Preferences & Location */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <MapPin className="w-5 h-5 text-rose-400" />
              <span>Vị trí & Tiêu chuẩn tìm kiếm</span>
            </div>

            {/* Location selector */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Vị trí của bạn</span>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{isGettingLocation ? 'Đang định vị...' : 'Lấy vị trí GPS'}</span>
                </button>
              </div>

              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Nhập thành phố (VD: Hà Nội, TP.HCM...)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
              />
              <p className="text-[11px] text-slate-500">
                Toạ độ GPS chính xác sẽ được bảo mật tuyệt đối và chỉ hiển thị khoảng cách ước tính (làm tròn 5 km).
              </p>
            </div>

            {/* Discovery preferences */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bạn muốn tìm kiếm ai?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'female', label: 'Nữ' },
                    { id: 'male', label: 'Nam' },
                    { id: 'other', label: 'Mọi người' },
                  ].map((opt) => {
                    const isSelected = genderFilter.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (genderFilter.length > 1) {
                              setGenderFilter(genderFilter.filter((g) => g !== opt.id));
                            }
                          } else {
                            setGenderFilter([...genderFilter, opt.id]);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                          isSelected
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Distance Slider */}
              <div>
                <div className="flex justify-between text-sm text-slate-300 mb-1">
                  <span>Khoảng cách tối đa:</span>
                  <span className="font-semibold text-rose-400">{maxDistanceKm} km</span>
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

              {/* Age Range Slider */}
              <div>
                <div className="flex justify-between text-sm text-slate-300 mb-1">
                  <span>Độ tuổi mong muốn (tối thiểu 18):</span>
                  <span className="font-semibold text-rose-400">
                    {minAge} - {maxAge} tuổi
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Từ tuổi</label>
                    <input
                      type="number"
                      min="18"
                      max={maxAge}
                      value={minAge}
                      onChange={(e) => setMinAge(Math.max(18, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Đến tuổi</label>
                    <input
                      type="number"
                      min={minAge}
                      max="100"
                      value={maxAge}
                      onChange={(e) => setMaxAge(Math.max(minAge, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                onClick={() => void handleStep4Finish()}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 px-6 py-2.5 rounded-xl font-semibold text-white shadow-lg shadow-rose-500/25 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang hoàn tất...' : 'Bắt đầu khám phá'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
