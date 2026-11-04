// Chuẩn id và tiêu đề việc – dùng chung cho server, giao diện và script đổi id (không phụ thuộc Next).
//
// Id việc: <MÃ DỰ ÁN>-<số 3 chữ số>, vd. SIA-014. Id đổi từ chuẩn cũ (BE-010, FE-010…) mà trùng số thì
// việc sửa sau thêm chữ thường: SIA-010, SIA-010a, SIA-010b… Mảng (BE/FE/OPS/DOC) không nằm trong id nữa
// mà đứng đầu tiêu đề: "[FE] Tiêu đề".

const AREA_TAG = /^\s*\[(BE|FE|OPS|DOC)\]\s*/;

export function formatTaskKey(projectCode: string, n: number, suffix = "") {
  return `${projectCode}-${String(n).padStart(3, "0")}${suffix}`;
}

export function taskKeyPattern(projectCode: string) {
  return new RegExp(`^${projectCode}-(\\d+)([a-z]*)$`);
}

// Gõ tay / gọi API thường viết hoa cả id: "sia-010a" → "SIA-010a"
export function normalizeKey(key: string) {
  const k = key.trim().toUpperCase();
  const m = /^(.*\d)([A-Z]+)$/.exec(k);
  return m ? m[1] + m[2].toLowerCase() : k;
}

export function stripAreaTag(title: string) {
  let t = title;
  while (AREA_TAG.test(t)) t = t.replace(AREA_TAG, "");
  return t.trim();
}

// Tiêu đề luôn bắt đầu bằng đúng một "[mảng] " khớp với mảng của việc
export function withAreaTag(title: string, area: string) {
  return `[${area}] ${stripAreaTag(title)}`;
}

// a, b, …, z, aa, ab, … – hậu tố cho id trùng số
export function suffixAt(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
