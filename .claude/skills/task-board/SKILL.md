---
name: task-board
description: Tạo, xem, cập nhật việc (task) trên Task Board – backlog kỹ thuật kiểu Jira của Siroby – qua API bằng CLI có sẵn. Dùng khi người dùng muốn tạo / sửa / đóng / tra cứu việc, chuyển trạng thái, giao việc, ghi nhật ký hay bình luận vào việc, xem backlog, hoặc biến lỗi test thành việc (mỗi lỗi test một việc, không tạo trùng). Kích hoạt với các từ như "task board", "backlog", "tạo task", "tạo việc", "BE-0xx", "FE-0xx", "lỗi test thành task", "cập nhật trạng thái việc".
---

# Task Board

Task Board quản lý backlog kỹ thuật (việc `BE-…`, `FE-…`, `OPS-…`, `DOC-…`). Skill này điều khiển nó qua REST API bằng CLI `scripts/tm.mjs`, không cần cài gói nào (Node ≥ 20).

## Chuẩn bị (một lần)

CLI cần hai biến `TM_API_URL` và `TM_API_TOKEN`. Nó đọc từ biến môi trường, hoặc tự nạp `.env.local` / `.env` ở thư mục đang chạy.

Kiểm tra: `node .claude/skills/task-board/scripts/tm.mjs me`

- In ra email → sẵn sàng.
- "Thiếu TM_API_URL hoặc TM_API_TOKEN" hoặc lỗi `401` → **dừng lại và nhờ người dùng tự làm**:
  1. Mở Task Board → **Tài khoản** → **Token API** → đặt tên token → **Tạo token**.
  2. Dán khối `TM_API_URL=…` / `TM_API_TOKEN=tm_…` vào `.env.local` của project này.
  3. Đảm bảo `.env.local` đã có trong `.gitignore`.

  Không xin token qua chat, không in token ra, không ghi token vào tệp được commit.

## Lệnh

Chạy từ gốc project và luôn gõ đủ `node .claude/skills/task-board/scripts/tm.mjs …`. Đừng gán lệnh vào biến kiểu `TM="node …"; $TM`, vì zsh không tách biến thành nhiều từ. Mọi lệnh in JSON; lỗi in ra stderr với exit code ≠ 0.

```bash
node .claude/skills/task-board/scripts/tm.mjs me                                    # tài khoản của token
node .claude/skills/task-board/scripts/tm.mjs sprints                               # mã đợt hợp lệ cho trường dot
node .claude/skills/task-board/scripts/tm.mjs list --trang_thai=moi,dang-lam --mang=BE --uu_tien=P1 --q="otp"   # thêm --json để lấy JSON
node .claude/skills/task-board/scripts/tm.mjs get BE-001                            # đủ trường + nhat_ky + binh_luan
node .claude/skills/task-board/scripts/tm.mjs create --tieu_de="…" --mang=BE [--loai=loi] [--uu_tien=P1] [--dot=D1-…] [--mo_ta="…"] \
           [--kiem_thu="…" --kiem_thu="…"] [--khoa_ngoai="…"]
node .claude/skills/task-board/scripts/tm.mjs update BE-001 --trang_thai=dang-lam [--nguoi_lam=email] [trường khác…]
node .claude/skills/task-board/scripts/tm.mjs log BE-001 "một dòng nhật ký"
node .claude/skills/task-board/scripts/tm.mjs comment BE-001 "bình luận"
```

Giá trị hợp lệ:

| Trường | Giá trị |
| --- | --- |
| `mang` | `BE` \| `FE` \| `OPS` \| `DOC` |
| `trang_thai` | `moi` → `san-sang` → `dang-lam` → `cho-duyet` → `xong`, hoặc `huy` |
| `uu_tien` | `P0` (chặn phát hành) \| `P1` (làm ngay) \| `P2` (trong đợt) \| `P3` (khi rảnh) |
| `loai` | `bao-mat` \| `loi` \| `don-dep` \| `hieu-nang` \| `tai-cau-truc` \| `tinh-nang` \| `tai-lieu` |
| `uoc_luong` | `S` (≤ nửa ngày) \| `M` (1–2 ngày) \| `L` (≥ 3 ngày) |

- Trường danh sách (`bang_chung`, `viec_can_lam`, `tieu_chi_xong`, `kiem_thu`, `phu_thuoc`): lặp cờ để có nhiều dòng. Khi `update`, danh sách mới **thay hẳn** danh sách cũ, nên muốn thêm một dòng thì `get` trước rồi gửi lại cả danh sách.
- `--truong=null` xoá giá trị của trường đó.
- Gửi nguyên một object JSON: `--json-body='{…}'` hoặc `--file=viec.json`.

**Việc con (một cấp):**
- **Chia nhỏ một việc** (các phần A/B/C, các lỗi tìm ra khi làm việc đó, phần tách ra làm riêng) thì **bắt buộc** dùng `--viec_cha=<id việc mẹ>`. Không chỉ ghi id vào `lien_quan.viec` hay viết "việc con của …" trong mô tả: như vậy app chỉ hiểu là hai việc liên quan, không hiện trong mục Việc con và không tính tiến độ.
- `lien_quan.viec` chỉ dành cho hai việc ngang hàng có dính dáng nhau. `phu_thuoc` dành cho việc phải xong trước.
- Việc đã tạo mà quên gắn cha: `update <ID> --viec_cha=<id việc mẹ>`.
- Tạo việc con: `create --viec_cha=BE-001 --tieu_de="…" --mang=BE`. Nên lấy mảng, đợt và ưu tiên giống việc cha.
- Xem các việc con: `get BE-001` (trường `viec_con`) hoặc `list --viec_cha=BE-001`.
- Việc con không có việc con. Việc đang có việc con không thể thành việc con.
- Thứ tự việc con chỉ đổi được bằng kéo thả trên web.

## Quy tắc

- **Không xoá việc.** Việc bỏ đi thì `--trang_thai=huy`.
- Đổi `trang_thai` hoặc `nguoi_lam` thì hệ thống tự ghi nhật ký. Muốn ghi thêm vì sao đổi thì dùng `log`.
- `dot` phải là mã có trong `node .claude/skills/task-board/scripts/tm.mjs sprints`. `nguoi_lam` phải là email của người dùng đã có trong hệ thống.
- `tieu_de` viết một dòng, nói **kết quả cần đạt**, không chỉ tả triệu chứng.
- Việc chạm tiền, bản thật, website hay dữ liệu của bé: đặt `--json-body` có `"can_phe_duyet":{"ai":"…","ly_do":"…"}`.

## Mỗi lỗi test thành một việc (không trùng)

Gán cho mỗi bài test lỗi một `khoa_ngoai` cố định, ví dụ `test:<tệp test>#<tên ca>`. Gọi `create` với khoá đã có thì **không** tạo việc mới, mà trả về việc cũ (stderr in "Đã có … – không tạo trùng").

1. Với mỗi ca lỗi: `create` với `khoa_ngoai`, `tieu_de`, `mang`, `--loai=loi`, `mo_ta` (thông báo lỗi chính, ngắn gọn), `kiem_thu` (lệnh chạy lại).
2. Lấy `id` từ kết quả, rồi ghi `log` một dòng tóm tắt lần lỗi này.
3. Nếu việc đang ở `xong` / `huy` mà test lại lỗi: `update <ID> --trang_thai=moi`, rồi `log` lý do mở lại.
4. Ca từng lỗi nay đã qua: tìm bằng `list --khoa_ngoai=…`, rồi `update <ID> --trang_thai=cho-duyet` và `log "Test đã qua"`. Không tự đặt `xong`; người duyệt sẽ làm việc đó.

Cuối cùng báo người dùng danh sách id đã tạo mới, đã ghi thêm, đã mở lại, đã chuyển chờ duyệt.

## Khi cần chi tiết

Đọc `reference/API.md`. Tệp này có đủ endpoint REST, mọi trường (`lien_quan`, `can_phe_duyet`…), mã lỗi `400` / `401` / `404` / `409`, và ví dụ `curl`.
