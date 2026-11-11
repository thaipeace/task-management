// Giá trị và nhãn lấy theo _huong_dan.truong trong backlog.json

// color: nhãn trạng thái; column / accent / count: nền cột, vạch màu đầu cột, ô đếm trên Bảng
export const STATUSES = [
  {
    value: "moi",
    label: "Mới",
    color: "bg-slate-100 text-slate-700",
    column: "bg-slate-100",
    accent: "border-t-slate-400",
    count: "bg-slate-200 text-slate-700",
  },
  {
    value: "san-sang",
    label: "Sẵn sàng",
    color: "bg-sky-100 text-sky-800",
    column: "bg-sky-100/70",
    accent: "border-t-sky-500",
    count: "bg-sky-200 text-sky-900",
  },
  {
    value: "dang-lam",
    label: "Đang làm",
    color: "bg-blue-100 text-blue-800",
    column: "bg-blue-100/70",
    accent: "border-t-blue-600",
    count: "bg-blue-200 text-blue-900",
  },
  {
    value: "cho-duyet",
    label: "Chờ duyệt",
    color: "bg-amber-100 text-amber-800",
    column: "bg-amber-100/80",
    accent: "border-t-amber-500",
    count: "bg-amber-200 text-amber-900",
  },
  {
    value: "dang-kiem-tra",
    label: "Đang kiểm tra",
    color: "bg-violet-100 text-violet-800",
    column: "bg-violet-100/70",
    accent: "border-t-violet-500",
    count: "bg-violet-200 text-violet-900",
  },
  {
    value: "xong",
    label: "Xong trên Dev",
    color: "bg-green-100 text-green-800",
    column: "bg-green-100/70",
    accent: "border-t-green-600",
    count: "bg-green-200 text-green-900",
  },
  {
    value: "released",
    label: "Released",
    color: "bg-emerald-600 text-white",
    column: "bg-emerald-200/60",
    accent: "border-t-emerald-700",
    count: "bg-emerald-600 text-white",
  },
  {
    value: "huy",
    label: "Huỷ",
    color: "bg-zinc-200 text-zinc-600",
    column: "bg-zinc-200/70",
    accent: "border-t-zinc-400",
    count: "bg-zinc-300 text-zinc-700",
  },
] as const;

// Version bản release gắn vào việc: 2.45.8-rc1, 2.45.8-r1, 2.46.0
export const RELEASE_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;
export const RELEASE_VERSION_HINT = "dạng 2.45.8-rc1";

// Đã làm xong: xong trên dev hoặc đã release
export const DONE_STATUSES = ["xong", "released"];
export const isDone = (status: string) => DONE_STATUSES.includes(status);

export const PRIORITIES = [
  { value: "P0", label: "P0 · Chặn phát hành", color: "bg-red-600 text-white" },
  { value: "P1", label: "P1 · Làm ngay", color: "bg-orange-500 text-white" },
  { value: "P2", label: "P2 · Trong đợt", color: "bg-yellow-400 text-yellow-950" },
  { value: "P3", label: "P3 · Khi rảnh", color: "bg-slate-300 text-slate-800" },
] as const;

export const AREAS = [
  { value: "BE", label: "BE · Máy chủ Worker", color: "bg-violet-100 text-violet-800" },
  { value: "FE", label: "FE · App / khu vui chơi", color: "bg-teal-100 text-teal-800" },
  { value: "OPS", label: "OPS · Vận hành", color: "bg-orange-100 text-orange-800" },
  { value: "DOC", label: "DOC · Tài liệu", color: "bg-pink-100 text-pink-800" },
] as const;

export const TYPES = [
  { value: "bao-mat", label: "Bảo mật", icon: "🛡" },
  { value: "loi", label: "Lỗi", icon: "🐞" },
  { value: "don-dep", label: "Dọn dẹp", icon: "🧹" },
  { value: "hieu-nang", label: "Hiệu năng", icon: "⚡" },
  { value: "tai-cau-truc", label: "Tái cấu trúc", icon: "🔧" },
  { value: "tinh-nang", label: "Tính năng", icon: "✨" },
  { value: "tai-lieu", label: "Tài liệu", icon: "📄" },
] as const;

export const ESTIMATES = [
  { value: "S", label: "S · ≤ nửa ngày" },
  { value: "M", label: "M · 1–2 ngày" },
  { value: "L", label: "L · ≥ 3 ngày" },
] as const;

export const RECORD_KINDS = {
  risk: { prefix: "AR", label: "Rủi ro đã chấp nhận", jsonKey: "chap_nhan_rui_ro" },
  decision: { prefix: "QD", label: "Chờ quyết định", jsonKey: "cho_quyet_dinh" },
} as const;

type Opt = { value: string; label: string };

export function labelOf(list: readonly Opt[], value: string | null | undefined) {
  return list.find((o) => o.value === value)?.label ?? value ?? "";
}

export function optionOf<T extends Opt>(list: readonly T[], value: string | null | undefined) {
  return list.find((o) => o.value === value);
}

export function today() {
  // ngày theo giờ Việt Nam, dạng YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}
