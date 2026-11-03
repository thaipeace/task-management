# Task Board API (v1)

API để tạo, đọc và sửa việc bằng lệnh hoặc từ project khác (script, CI, Claude Code…). Tên trường giống hệt mảng `viec` trong `backlog.json`.

## Xác thực

1. Đăng nhập Task Board → **Tài khoản** → **Token API** → đặt tên (vd. `siroby-app`) → **Tạo token**.
2. Token (dạng `tm_…`) chỉ hiện **một lần**. Copy khối hiện ra vào `.env.local` của project sẽ gọi API:
   ```
   TM_API_URL=https://<app-của-bạn>.vercel.app
   TM_API_TOKEN=tm_…
   ```
   Đừng commit tệp này, đừng dán token vào chat. Mất token thì thu hồi rồi tạo token mới.
3. Mọi request gửi header `Authorization: Bearer $TM_API_TOKEN`.

Token có quyền như tài khoản đã tạo ra nó. Tài khoản bị khoá hoặc token bị thu hồi thì API trả `401` ngay. Nhật ký ghi tên người chủ token.

## Cách nhanh nhất: CLI `scripts/tm.mjs`

Không cần cài gì (Node ≥ 20). Chép tệp này sang project khác hoặc gọi thẳng đường dẫn. CLI tự đọc `TM_API_URL` / `TM_API_TOKEN` từ biến môi trường hoặc `.env.local` / `.env` ở thư mục hiện tại.

```bash
node scripts/tm.mjs me
node scripts/tm.mjs list --trang_thai=moi,dang-lam --mang=BE
node scripts/tm.mjs get BE-001
node scripts/tm.mjs create --tieu_de="Sửa lỗi X" --mang=BE --loai=loi --uu_tien=P1 \
  --kiem_thu="node kiem-thu/may-chu.mjs" --kiem_thu="node kiem-thu/gop-web.mjs"
node scripts/tm.mjs update BE-001 --trang_thai=dang-lam --nguoi_lam=me@congty.com
node scripts/tm.mjs comment BE-001 "Đã tái hiện trên bản thử"
node scripts/tm.mjs log BE-001 "Chạy lại may-chu.mjs: ĐẠT"
```

- Trường danh sách (`bang_chung`, `viec_can_lam`, `tieu_chi_xong`, `kiem_thu`, `phu_thuoc`): lặp cờ để thêm nhiều dòng. Khi `update`, danh sách gửi lên **thay hẳn** danh sách cũ.
- `--trường=null` xoá giá trị của trường đó.
- Muốn gửi nguyên một object JSON thì dùng `--json-body='{…}'` hoặc `--file=viec.json`.

## Endpoint

Gốc: `$TM_API_URL/api/v1`. Body và kết quả đều là JSON. Khi lỗi, API trả `{ "loi": "…", "chi_tiet"?: […] }`.

| Lệnh | Đường dẫn | Việc |
| --- | --- | --- |
| GET | `/me` | Tài khoản của token: `{ id, email, name, role }` |
| GET | `/sprints` | `{ dot: [{ ma, mo_ta }] }` |
| GET | `/tasks` | Danh sách việc, không kèm `nhat_ky` |
| POST | `/tasks` | Tạo việc |
| GET | `/tasks/{id}` | Một việc, kèm `nhat_ky` và `binh_luan` |
| PATCH | `/tasks/{id}` | Sửa một phần: chỉ gửi trường cần đổi |
| POST | `/tasks/{id}/comments` | `{ "noi_dung": "…" }` → thêm bình luận |
| POST | `/tasks/{id}/logs` | `{ "ghi": "…" }` → thêm một dòng `nhat_ky` |

API không có lệnh xoá việc. Theo quy ước của backlog, việc bỏ thì đổi `trang_thai` thành `huy`.

### Lọc `GET /tasks`

Tham số query, tất cả đều không bắt buộc:

- `trang_thai`: một hoặc nhiều giá trị, ngăn bằng dấu phẩy, vd. `moi,san-sang`.
- `dot`: mã đợt, hoặc `none` để lấy việc chưa xếp đợt.
- `mang`, `uu_tien`, `loai`.
- `nguoi_lam`: email, `me` (chủ token) hoặc `none` (chưa giao).
- `q`: tìm trong id, tiêu đề và mô tả.
- `khoa_ngoai`: tìm đúng việc mang khoá đó.
- `gioi_han`: số việc tối đa, mặc định 200, lớn nhất 1000.

Kết quả có dạng `{ "so_luong": n, "viec": [...] }`.

### Trường của việc

| Trường | Kiểu | Giá trị |
| --- | --- | --- |
| `id` | chỉ đọc | Cấp tự động theo `mang`: `BE-016`, `FE-011`… |
| `tieu_de` | string | **Bắt buộc khi tạo.** Một dòng, nói kết quả cần đạt |
| `mang` | enum | **Bắt buộc khi tạo.** `BE` \| `FE` \| `OPS` \| `DOC` |
| `loai` | enum | `bao-mat` \| `loi` \| `don-dep` \| `hieu-nang` \| `tai-cau-truc` \| `tinh-nang` \| `tai-lieu`. Mặc định `loi` |
| `dot` | string \| null | Mã đợt phải có sẵn (xem `/sprints`) |
| `uu_tien` | enum | `P0` \| `P1` \| `P2` \| `P3`. Mặc định `P2` |
| `trang_thai` | enum | `moi` \| `san-sang` \| `dang-lam` \| `cho-duyet` \| `xong` \| `huy`. Mặc định `moi` |
| `uoc_luong` | enum \| null | `S` \| `M` \| `L` |
| `mo_ta`, `rui_ro`, `nguon` | string | |
| `bang_chung`, `viec_can_lam`, `tieu_chi_xong`, `kiem_thu`, `phu_thuoc` | string[] | |
| `can_phe_duyet` | `{ ai, ly_do }` \| null | |
| `lien_quan` | `{ issue, pr, viec: [], tai_lieu: [] }` | `issue` / `pr` là số hoặc chuỗi |
| `nhanh_goi_y` | string \| null | |
| `nguoi_lam` | email \| null | Người dùng phải có sẵn và đang hoạt động |
| `khoa_ngoai` | string \| null | Khoá do công cụ ngoài tự đặt, duy nhất trong toàn hệ thống (xem bên dưới) |
| `tao_luc`, `cap_nhat_luc`, `nhat_ky` | chỉ đọc | |

Gửi trường không có trong bảng → `400`. Đổi `trang_thai` hoặc `nguoi_lam` → hệ thống tự thêm một dòng `nhat_ky`.

### Mã lỗi

| Mã | Khi nào |
| --- | --- |
| `400` | Body không phải JSON, sai kiểu hoặc giá trị, gửi trường lạ, đợt không có, email người làm không có |
| `401` | Thiếu token, token sai hoặc đã thu hồi, tài khoản bị khoá |
| `404` | Không có việc mang id đó |
| `409` | `khoa_ngoai` đã thuộc về việc khác |

## Mỗi lỗi test thành một việc (không tạo trùng)

Đặt `khoa_ngoai` là một chuỗi cố định cho từng bài test, vd. `test:kiem-thu/may-chu.mjs#phan-G`.

- `POST /tasks` với `khoa_ngoai` **chưa có** → tạo việc mới, trả `201`, `"tao_moi": true`.
- `POST /tasks` với `khoa_ngoai` **đã có** → không tạo gì, trả `200`, `"tao_moi": false`, `"viec"` là việc cũ. Vì vậy chạy test lại bao nhiêu lần cũng chỉ có một việc cho mỗi lỗi.

Quy trình gợi ý sau mỗi lần chạy test:

```bash
TM="node path/to/tm.mjs"

# test lỗi → tạo việc (hoặc lấy lại việc cũ), rồi ghi nhật ký lần lỗi này
$TM create --khoa_ngoai="test:may-chu.mjs#phan-G" --mang=BE --loai=loi --uu_tien=P1 \
  --tieu_de="may-chu.mjs phần G lỗi: đơn web cho SĐT đã có tài khoản" \
  --mo_ta="$(tail -n 40 test-output.log)" --kiem_thu="node kiem-thu/may-chu.mjs" --nguon="Chạy test tự động"
# lệnh create in ra id ở stderr; hoặc tra lại theo khoá:
ID=$($TM list --khoa_ngoai="test:may-chu.mjs#phan-G" --json | node -pe 'JSON.parse(require("fs").readFileSync(0)).viec[0]?.id')
$TM log "$ID" "Lỗi lại lúc $(date +%H:%M): <tóm tắt>"

# việc đã xong / huỷ mà test lại lỗi → mở lại
$TM update "$ID" --trang_thai=moi

# test đã qua → đưa việc sang chờ duyệt
$TM update "$ID" --trang_thai=cho-duyet && $TM log "$ID" "Test đã qua"
```

## Ví dụ với curl

```bash
curl -s "$TM_API_URL/api/v1/tasks?trang_thai=moi&mang=BE" -H "Authorization: Bearer $TM_API_TOKEN"

curl -s -X POST "$TM_API_URL/api/v1/tasks" \
  -H "Authorization: Bearer $TM_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"tieu_de":"Sửa lỗi X","mang":"BE","uu_tien":"P1","kiem_thu":["node kiem-thu/may-chu.mjs"]}'

curl -s -X PATCH "$TM_API_URL/api/v1/tasks/BE-016" \
  -H "Authorization: Bearer $TM_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"trang_thai":"dang-lam"}'
```

## Mã nguồn

- Route: `src/app/api/v1/**/route.ts`
- Xác thực token, kiểm tra dữ liệu và đổi tên trường: `src/lib/api.ts`
- Đọc việc theo cấu trúc backlog: `src/lib/api-tasks.ts` + `toBacklogTask` trong `src/lib/backlog.ts`
- Logic tạo / sửa và ghi nhật ký (dùng chung với giao diện): `src/lib/task-service.ts`
