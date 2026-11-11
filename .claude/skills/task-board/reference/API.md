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

Tuỳ chọn: thêm `TM_PROJECT=SIA` để CLI mặc định làm việc trong một dự án (xem **Dự án** bên dưới).

Token có quyền như tài khoản đã tạo ra nó. Tài khoản bị khoá hoặc token bị thu hồi thì API trả `401` ngay. Nhật ký ghi tên người chủ token.

## Cách nhanh nhất: CLI `scripts/tm.mjs` (trong thư mục skill)

Không cần cài gì (Node ≥ 20). Chạy từ gốc project có skill: CLI tự đọc `TM_API_URL` / `TM_API_TOKEN` từ biến môi trường hoặc `.env.local` / `.env` ở thư mục hiện tại.

```bash
node .claude/skills/task-board/scripts/tm.mjs me
node .claude/skills/task-board/scripts/tm.mjs list --trang_thai=moi,dang-lam --mang=BE
node .claude/skills/task-board/scripts/tm.mjs get SIA-001
node .claude/skills/task-board/scripts/tm.mjs create --tieu_de="Sửa lỗi X" --mang=BE --loai=loi --uu_tien=P1 \
  --kiem_thu="node kiem-thu/may-chu.mjs" --kiem_thu="node kiem-thu/gop-web.mjs"
node .claude/skills/task-board/scripts/tm.mjs update SIA-001 --trang_thai=dang-lam --nguoi_lam=me@congty.com
node .claude/skills/task-board/scripts/tm.mjs comment SIA-001 "Đã tái hiện trên bản thử"
node .claude/skills/task-board/scripts/tm.mjs log SIA-001 "Chạy lại may-chu.mjs: ĐẠT"
```

- Trường danh sách (`bang_chung`, `viec_can_lam`, `tieu_chi_xong`, `kiem_thu`, `phu_thuoc`): lặp cờ để thêm nhiều dòng. Khi `update`, danh sách gửi lên **thay hẳn** danh sách cũ.
- `--trường=null` xoá giá trị của trường đó.
- Muốn gửi nguyên một object JSON thì dùng `--json-body='{…}'` hoặc `--file=viec.json`.

## Dự án

Việc, đợt và AR/QD thuộc từng dự án. Người dùng và token dùng chung cho mọi dự án.

- Dự án SIA (SirobyApp) là dự án đầu tiên và là **mặc định**.
- **Id việc** = `<mã dự án>-<số>`: `SIA-019`, `ABC-001`. Id đổi từ chuẩn cũ mà trùng số có thêm chữ thường: `SIA-010`, `SIA-010a`, `SIA-010b`.
- **Mảng nằm đầu tiêu đề**, không nằm trong id: `"[FE] Mỗi bé một dữ liệu riêng"`. Server tự thêm hoặc sửa thẻ theo `mang` khi tạo việc, khi sửa `tieu_de` và khi đổi `mang`. Thẻ gửi lên sai thì bị thay bằng thẻ đúng.
- **Id cũ** (`BE-010`, `FE-010`…) vẫn dùng được ở đường dẫn `/tasks/{id}` và ở `viec_cha`: API tự đổi sang id mới. Kết quả luôn trả id mới. `q` cũng tìm được theo id cũ.
- AR / QD giữ id riêng: `AR-003`, `QD-004` (dự án tạo sau: `ABC-QD-001`).
- `POST /tasks` nhận `du_an` (mã dự án). Không gửi thì việc vào dự án mặc định. Việc không chuyển được sang dự án khác, nên `PATCH` không nhận `du_an`.
- `dot` và `viec_cha` phải thuộc cùng dự án với việc.
- Chỉ admin thêm được dự án, trên web ở trang **Quản trị → Dự án**.

## Văn bản là Markdown

`mo_ta`, `rui_ro`, `nguon`, `can_phe_duyet.ly_do`, `noi_dung` của bình luận, `ghi` của nhật ký và dữ liệu AR/QD được lưu nguyên dạng chữ và hiển thị dưới dạng Markdown kiểu GitHub:
- Đậm, nghiêng, gạch ngang, `code`, khối code, link, danh sách, việc cần tích, trích dẫn, bảng.
- Xuống dòng một lần (`\n`) là xuống dòng.
- Id việc tự thành liên kết.
- HTML không được render.

Phần tử của các trường danh sách (`viec_can_lam`, `tieu_chi_xong`, `bang_chung`, `kiem_thu`) là một dòng, chỉ dùng định dạng trong dòng. `tieu_de` là chữ thường.

Trong JSON, xuống dòng viết là `\n`. Với CLI: `--mo_ta_file=tệp.md` hoặc `comment <ID> -` (đọc stdin).

## Endpoint

Gốc: `$TM_API_URL/api/v1`. Body và kết quả đều là JSON. Khi lỗi, API trả `{ "loi": "…", "chi_tiet"?: […] }`.

| Lệnh | Đường dẫn | Việc |
| --- | --- | --- |
| GET | `/me` | Tài khoản của token: `{ id, email, name, role }` |
| GET | `/projects` | `{ du_an: [{ ma, ten, mo_ta, mau_id_viec, mac_dinh }] }` |
| GET | `/sprints` | `{ dot: [{ du_an, ma, mo_ta }] }`. Thêm `?du_an=SIA` để lấy đợt của một dự án |
| GET | `/tasks` | Danh sách việc, không kèm `nhat_ky` |
| POST | `/tasks` | Tạo việc |
| GET | `/tasks/{id}` | Một việc, kèm `nhat_ky`, `binh_luan` (có `sua_luc` nếu bình luận đã sửa) và `viec_con` |
| PATCH | `/tasks/{id}` | Sửa một phần: chỉ gửi trường cần đổi |
| POST | `/tasks/{id}/comments` | `{ "noi_dung": "…" }` → thêm bình luận |
| PATCH | `/tasks/{id}/comments/{comment_id}` | `{ "noi_dung": "…" }` → sửa bình luận (thay hẳn nội dung). Chỉ sửa được bình luận do tài khoản của token viết, không thì 403. `comment_id` là `binh_luan[].id` trong `GET /tasks/{id}` |
| GET | `/records` | Bản ghi AR / QD, cùng dạng backlog.json: `{ chap_nhan_rui_ro: [{ id, du_an, … }], cho_quyet_dinh: [{ id, du_an, … }] }`. Lọc `?du_an=SIA`, `?loai=rui_ro` hoặc `quyet_dinh` |
| GET | `/records/{id}` | Một bản ghi (vd. `QD-002`), kèm `loai` |
| POST | `/records` | Tạo bản ghi, id tự cấp: `{ "du_an": "SIA", "loai": "quyet_dinh", "cau_hoi": "…", … }` → 201 |
| PATCH | `/records/{id}` | Sửa một phần: chỉ gửi trường cần đổi, `null` = xoá trường. Trường lạ có sẵn (từ backlog.json) được giữ |
| GET | `/goals` | Mục tiêu kèm tiến độ tính đến hôm nay (`?du_an=SIA`). Chỉ đọc; mục tiêu đặt trên web |
| GET | `/weekly` | Số liệu báo cáo tuần so với mục tiêu, kèm `ban_nhap` (Markdown) và `bao_cao` (bản đã viết hoặc `null`). `?du_an=SIA&tuan=YYYY-MM-DD` (ngày bất kỳ trong tuần; tuần bắt đầu thứ Hai; không gửi thì là tuần này). `cach_tinh` giải thích công thức |
| GET | `/releases` | Các đợt Dev release, mới nhất trước. `?du_an=SIA&main=2.45.0` |
| PUT | `/releases` | `{ "du_an": "SIA", "main": "2.45.0", "rc"?: 2, "noi_dung": "Markdown", "viec"?: ["SIA-003"] }` → `viec`: gắn version đợt này vào các việc (phải đang Xong trên Dev, sai một việc thì từ chối cả lệnh). Không gửi `rc` thì tạo đợt mới với số kế tiếp (`2.45.0-rc1`, `-rc2`…); gửi `rc` thì ghi đè đợt đó. Trả `phien_ban`, `rc`, `tao_moi`, `viec_da_gan` |
| PUT | `/weekly` | `{ "du_an": "SIA", "tuan"?: "YYYY-MM-DD", "noi_dung": "Markdown" }` → ghi hoặc ghi đè báo cáo tuần; lưu kèm số liệu lúc ghi |
| POST | `/tasks/{id}/logs` | `{ "ghi": "…" }` → thêm một dòng `nhat_ky` |

API không có lệnh xoá việc. Theo quy ước của backlog, việc bỏ thì đổi `trang_thai` thành `huy`.

### Trường của AR / QD

| `loai` | Trường | Ghi chú |
|---|---|---|
| `quyet_dinh` (QD) | `cau_hoi` (bắt buộc), `ai`, `chan_viec` (string[] id việc, phải có trong dự án), `chan_phat_hanh` (boolean), `ghi`, `tra_loi` | `tra_loi` = quyết định đã chốt, ghi khi người có quyền đã trả lời |
| `rui_ro` (AR) | `tieu_de` (bắt buộc), `nguon`, `danh_gia`, `xem_lai_khi`, `ghi` | |

Văn bản là Markdown. Không có lệnh xoá qua API (chỉ admin xoá trên web).

### Lọc `GET /tasks`

Tham số query, tất cả đều không bắt buộc:

- `du_an`: mã dự án. Không gửi thì lấy việc của mọi dự án.
- `trang_thai`: một hoặc nhiều giá trị, ngăn bằng dấu phẩy, vd. `moi,san-sang`.
- `dot`: mã đợt, hoặc `none` để lấy việc chưa xếp đợt.
- `mang`, `uu_tien`, `loai`.
- `nguoi_lam`: email, `me` (chủ token) hoặc `none` (chưa giao).
- `q`: tìm trong id, tiêu đề và mô tả.
- `khoa_ngoai`: tìm đúng việc mang khoá đó.
- `viec_cha`: id việc cha để lấy các việc con của nó, hoặc `none` để chỉ lấy việc lớn.
- `gioi_han`: số việc tối đa, mặc định 200, lớn nhất 1000.

Kết quả có dạng `{ "so_luong": n, "viec": [...] }`.

### Trường của việc

| Trường | Kiểu | Giá trị |
| --- | --- | --- |
| `id` | chỉ đọc | Cấp tự động theo dự án: `SIA-019`, `SIA-020`… (id cũ đổi sang có thể có hậu tố: `SIA-010a`) |
| `du_an` | mã dự án | Chỉ gửi khi tạo. Mặc định là dự án đầu tiên (SIA). Có trong mọi kết quả |
| `tieu_de` | string | **Bắt buộc khi tạo.** Một dòng, nói kết quả cần đạt. Server tự thêm `[mang] ` ở đầu |
| `mang` | enum | **Bắt buộc khi tạo.** `BE` \| `FE` \| `OPS` \| `DOC`. Hiện thành thẻ đầu tiêu đề |
| `loai` | enum | `bao-mat` \| `loi` \| `don-dep` \| `hieu-nang` \| `tai-cau-truc` \| `tinh-nang` \| `tai-lieu`. Mặc định `loi` |
| `dot` | string \| null | Mã đợt phải có sẵn trong dự án của việc (xem `/sprints?du_an=…`) |
| `uu_tien` | enum | `P0` \| `P1` \| `P2` \| `P3`. Mặc định `P2` |
| `trang_thai` | enum | `moi` \| `san-sang` \| `dang-lam` \| `cho-duyet` \| `dang-kiem-tra` (đang kiểm tra) \| `xong` (xong trên dev) \| `released` (đã lên production) \| `huy`. Mặc định `moi` |
| `uoc_luong` | enum \| null | `S` \| `M` \| `L` |
| `phien_ban` | string \| null | Bản release đầu tiên có việc, vd. `2.45.8-rc1` (gắn qua `PUT /releases` với `viec`) |
| `mo_ta`, `rui_ro`, `nguon` | string | |
| `bang_chung`, `viec_can_lam`, `tieu_chi_xong`, `kiem_thu`, `phu_thuoc` | string[] | |
| `can_phe_duyet` | `{ ai, ly_do }` \| null | |
| `lien_quan` | `{ issue, pr, viec: [], tai_lieu: [] }` | `issue` / `pr` là số hoặc chuỗi |
| `nhanh_goi_y` | string \| null | |
| `nguoi_lam` | email \| null | Người dùng phải có sẵn và đang hoạt động |
| `viec_cha` | id \| null | Gắn làm việc con của việc đó; `null` = tách ra. Việc con chỉ một cấp: việc cha không được là việc con, và việc đang có việc con thì không thành việc con được (vi phạm → `400`) |
| `viec_con` | chỉ đọc | Chỉ có ở `GET /tasks/{id}` của việc lớn: `[{ id, tieu_de, trang_thai }]` theo thứ tự kéo thả |
| `thu_tu_con` | chỉ đọc | Thứ tự của việc con trong việc cha (có trong export) |
| `khoa_ngoai` | string \| null | Khoá do công cụ ngoài tự đặt, duy nhất trong toàn hệ thống (xem bên dưới) |
| `tao_luc`, `cap_nhat_luc`, `nhat_ky` | chỉ đọc | |

Gửi trường không có trong bảng → `400`. Đổi `trang_thai` hoặc `nguoi_lam` → hệ thống tự thêm một dòng `nhat_ky`.

### Mã lỗi

| Mã | Khi nào |
| --- | --- |
| `400` | Body không phải JSON, sai kiểu hoặc giá trị, gửi trường lạ, dự án / đợt không có, việc cha thuộc dự án khác, email người làm không có |
| `401` | Thiếu token, token sai hoặc đã thu hồi, tài khoản bị khoá |
| `404` | Không có việc mang id đó |
| `409` | `khoa_ngoai` đã thuộc về việc khác |

## Mỗi lỗi test thành một việc (không tạo trùng)

Đặt `khoa_ngoai` là một chuỗi cố định cho từng bài test, vd. `test:kiem-thu/may-chu.mjs#phan-G`.

- `POST /tasks` với `khoa_ngoai` **chưa có** → tạo việc mới, trả `201`, `"tao_moi": true`.
- `POST /tasks` với `khoa_ngoai` **đã có** → không tạo gì, trả `200`, `"tao_moi": false`, `"viec"` là việc cũ. Vì vậy chạy test lại bao nhiêu lần cũng chỉ có một việc cho mỗi lỗi.

Quy trình gợi ý sau mỗi lần chạy test:

```bash

# test lỗi → tạo việc (hoặc lấy lại việc cũ), rồi ghi nhật ký lần lỗi này
node .claude/skills/task-board/scripts/tm.mjs create --khoa_ngoai="test:may-chu.mjs#phan-G" --mang=BE --loai=loi --uu_tien=P1 \
  --tieu_de="may-chu.mjs phần G lỗi: đơn web cho SĐT đã có tài khoản" \
  --mo_ta="$(tail -n 40 test-output.log)" --kiem_thu="node kiem-thu/may-chu.mjs" --nguon="Chạy test tự động"
# lệnh create in ra id ở stderr; hoặc tra lại theo khoá:
ID=$(node .claude/skills/task-board/scripts/tm.mjs list --khoa_ngoai="test:may-chu.mjs#phan-G" --json | node -pe 'JSON.parse(require("fs").readFileSync(0)).viec[0]?.id')
node .claude/skills/task-board/scripts/tm.mjs log "$ID" "Lỗi lại lúc $(date +%H:%M): <tóm tắt>"

# việc đã xong / huỷ mà test lại lỗi → mở lại
node .claude/skills/task-board/scripts/tm.mjs update "$ID" --trang_thai=moi

# test đã qua → đưa việc sang chờ duyệt
node .claude/skills/task-board/scripts/tm.mjs update "$ID" --trang_thai=cho-duyet && node .claude/skills/task-board/scripts/tm.mjs log "$ID" "Test đã qua"
```

## Ví dụ với curl

```bash
curl -s "$TM_API_URL/api/v1/tasks?trang_thai=moi&mang=BE" -H "Authorization: Bearer $TM_API_TOKEN"

curl -s -X POST "$TM_API_URL/api/v1/tasks" \
  -H "Authorization: Bearer $TM_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"tieu_de":"Sửa lỗi X","mang":"BE","uu_tien":"P1","kiem_thu":["node kiem-thu/may-chu.mjs"]}'

curl -s -X PATCH "$TM_API_URL/api/v1/tasks/SIA-016" \
  -H "Authorization: Bearer $TM_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"trang_thai":"dang-lam"}'
```

## Mã nguồn (repo task-management)

- Route: `src/app/api/v1/**/route.ts`
- Xác thực token, kiểm tra dữ liệu và đổi tên trường: `src/lib/api.ts`
- Đọc việc theo cấu trúc backlog: `src/lib/api-tasks.ts` + `toBacklogTask` trong `src/lib/backlog.ts`
- Logic tạo / sửa và ghi nhật ký (dùng chung với giao diện): `src/lib/task-service.ts`
