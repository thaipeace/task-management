---
name: task-board
description: Tạo, xem, cập nhật việc (task) trên Task Board – backlog kỹ thuật kiểu Jira của Siroby – qua API bằng CLI có sẵn. Dùng khi người dùng muốn tạo / sửa / đóng / tra cứu việc, chuyển trạng thái, giao việc, ghi nhật ký hay bình luận vào việc, xem backlog, hoặc biến lỗi test thành việc (mỗi lỗi test một việc, không tạo trùng). Kích hoạt với các từ như "task board", "backlog", "tạo task", "tạo việc", "SIA-0xx", "BE-0xx", "FE-0xx", "lỗi test thành task", "cập nhật trạng thái việc".
---

# Task Board

Task Board quản lý backlog kỹ thuật, chia theo **dự án**. Skill này điều khiển Task Board qua REST API bằng CLI `scripts/tm.mjs`, không cần cài gói nào (Node ≥ 20).

## Chuẩn id và tiêu đề (bắt buộc)

- **Id việc** = `<MÃ DỰ ÁN>-<số>`, vd. `SIA-019`. Hệ thống tự cấp id khi tạo; không tự đặt id.
- Id đổi từ chuẩn cũ mà trùng số có thêm chữ thường ở cuối: `SIA-010`, `SIA-010a`, `SIA-010b`. Viết đúng chữ thường đó khi nhắc tới việc.
- **Mảng không nằm trong id** mà đứng đầu tiêu đề: `[BE] …`, `[FE] …`, `[OPS] …`, `[DOC] …`. Server tự thêm hoặc sửa thẻ này theo `mang` (cả khi tạo lẫn khi đổi `mang`), nên chỉ cần gửi `--mang` và phần tiêu đề còn lại.
- Id cũ (`BE-010`, `FE-010`…) vẫn dùng được trong lệnh: API tự đổi sang id mới. Nhưng khi **viết** (mô tả, nhật ký, bình luận, `phu_thuoc`, `lien_quan.viec`, `viec_cha`) thì luôn dùng id mới. Muốn biết id mới thì chạy `get <id cũ>`.
- AR / QD giữ id riêng (`AR-003`, `QD-004`).

## Định dạng văn bản: Markdown

`mo_ta`, `rui_ro`, `nguon`, `can_phe_duyet.ly_do`, bình luận, nhật ký, AR/QD và từng dòng của các trường danh sách đều hiển thị dưới dạng **Markdown kiểu GitHub**:
- `**đậm**`, `*nghiêng*`, `~~gạch~~`, `` `code` ``, link `[chữ](https://…)`.
- Khối code ``` nhiều dòng, danh sách `- `, `1. `, việc cần tích `- [ ] `, trích dẫn `> `, bảng, tiêu đề `### `.
- Xuống dòng một lần là xuống dòng thật.
- Id việc (`SIA-010a`, `QD-002`) tự thành liên kết; đừng bọc id trong link hay trong `code`.
- Không dùng HTML: thẻ HTML hiện nguyên chữ.
- Trường danh sách (`viec_can_lam`, `tieu_chi_xong`, `bang_chung`, `kiem_thu`): mỗi phần tử một dòng, chỉ dùng định dạng trong dòng (đậm, code, link), không lồng danh sách hay khối code.
- Tiêu đề (`tieu_de`) là chữ thường một dòng, không dùng Markdown.

Văn bản nhiều dòng: ghi ra tệp rồi dùng `--mo_ta_file=tệp.md` (mọi trường đều có dạng `--<trường>_file=`), hoặc truyền qua stdin bằng `-`:

```bash
node .claude/skills/task-board/scripts/tm.mjs comment SIA-010a - <<'MD'
**Đã tái hiện** trên bản dev:
- Lệnh: `npm run dev -- --remote`
- Xem thêm [tài liệu Cloudflare](https://developers.cloudflare.com/)
MD
node .claude/skills/task-board/scripts/tm.mjs update SIA-010a --mo_ta_file=mo-ta.md
```

## Chuẩn bị (một lần)

CLI cần hai biến `TM_API_URL` và `TM_API_TOKEN`. Nó đọc từ biến môi trường, hoặc tự nạp `.env.local` / `.env` ở thư mục đang chạy.

Nên đặt thêm `TM_PROJECT=<mã dự án>` (vd. `TM_PROJECT=SIA`) trong `.env.local`. Khi đó `create`, `list` và `sprints` tự làm việc trong dự án đó. Không đặt thì `create` vào dự án mặc định (dự án tạo đầu tiên), còn `list` / `sprints` lấy mọi dự án. Cờ `--du_an=…` ghi đè biến này.

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
node .claude/skills/task-board/scripts/tm.mjs projects                              # mã dự án hợp lệ cho --du_an
node .claude/skills/task-board/scripts/tm.mjs sprints [--du_an=SIA]                 # mã đợt hợp lệ cho trường dot
node .claude/skills/task-board/scripts/tm.mjs list --trang_thai=moi,dang-lam --mang=BE --uu_tien=P1 --q="otp"   # thêm --json để lấy JSON
node .claude/skills/task-board/scripts/tm.mjs get SIA-001                           # đủ trường + nhat_ky + binh_luan
node .claude/skills/task-board/scripts/tm.mjs create --tieu_de="…" --mang=BE [--loai=loi] [--uu_tien=P1] [--dot=D1-…] [--mo_ta="…"] \
           [--kiem_thu="…" --kiem_thu="…"] [--khoa_ngoai="…"]
node .claude/skills/task-board/scripts/tm.mjs update SIA-001 --trang_thai=dang-lam [--nguoi_lam=email] [trường khác…]
node .claude/skills/task-board/scripts/tm.mjs records [--du_an=SIA] [--loai=quyet_dinh]   # AR (chấp nhận rủi ro) + QD (chờ quyết định)
node .claude/skills/task-board/scripts/tm.mjs record QD-002                         # một bản ghi
node .claude/skills/task-board/scripts/tm.mjs log SIA-001 "một dòng nhật ký"
node .claude/skills/task-board/scripts/tm.mjs comment SIA-001 "bình luận"
node .claude/skills/task-board/scripts/tm.mjs comment-edit SIA-001 42 "nội dung mới"   # 42 = binh_luan[].id trong get
```

Rủi ro đã chấp nhận (AR) và câu hỏi chờ quyết định (QD) đọc bằng `records` / `record`. Các trang web (`/records`, `/board`…) cần đăng nhập bằng trình duyệt, token API không mở được; mọi thứ LLM cần đều có qua CLI / API.

Sửa bình luận: chỉ sửa được bình luận do chính tài khoản của token viết (của người khác → 403). Nội dung mới thay hẳn nội dung cũ, nên muốn thêm ý thì `get` để lấy nội dung cũ rồi gửi lại cả bài. Bình luận được đánh dấu "đã sửa". Muốn ghi tiến triển mới thì thêm bình luận mới hoặc `log`, đừng sửa bình luận cũ.

Giá trị hợp lệ:

| Trường | Giá trị |
| --- | --- |
| `mang` | `BE` \| `FE` \| `OPS` \| `DOC` |
| `trang_thai` | `moi` → `san-sang` → `dang-lam` → `cho-duyet` → `dang-kiem-tra` (đang kiểm tra) → `xong` (xong trên dev) → `released` (đã lên production), hoặc `huy` |
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
- Tạo việc con: `create --viec_cha=SIA-010a --tieu_de="…" --mang=FE`. Nên lấy mảng, đợt và ưu tiên giống việc cha.
- Xem các việc con: `get SIA-010a` (trường `viec_con`) hoặc `list --viec_cha=SIA-010a`.
- Việc con không có việc con. Việc đang có việc con không thể thành việc con.
- Thứ tự việc con chỉ đổi được bằng kéo thả trên web.

## Quy tắc

- **Không xoá việc.** Việc bỏ đi thì `--trang_thai=huy`.
- Đổi `trang_thai` hoặc `nguoi_lam` thì hệ thống tự ghi nhật ký. Muốn ghi thêm vì sao đổi thì dùng `log`.
- Mỗi việc thuộc một dự án, chọn lúc tạo, **không chuyển được** sang dự án khác. `dot` và `viec_cha` phải cùng dự án với việc. Kết quả `get` / `list` có trường `du_an`.
- `dot` phải là mã có trong `node .claude/skills/task-board/scripts/tm.mjs sprints --du_an=<dự án>`. `nguoi_lam` phải là email của người dùng đã có trong hệ thống.
- `tieu_de` viết một dòng, nói **kết quả cần đạt**, không chỉ tả triệu chứng. Không cần tự gõ `[mảng]`; server tự thêm.
- Việc chạm tiền, bản thật, website hay dữ liệu của bé: đặt `--json-body` có `"can_phe_duyet":{"ai":"…","ly_do":"…"}`.

## Mỗi lỗi test thành một việc (không trùng)

Gán cho mỗi bài test lỗi một `khoa_ngoai` cố định, ví dụ `test:<tệp test>#<tên ca>`. Gọi `create` với khoá đã có thì **không** tạo việc mới, mà trả về việc cũ (stderr in "Đã có … – không tạo trùng").

1. Với mỗi ca lỗi: `create` với `khoa_ngoai`, `tieu_de`, `mang`, `--loai=loi`, `mo_ta` (thông báo lỗi chính, ngắn gọn), `kiem_thu` (lệnh chạy lại).
2. Lấy `id` từ kết quả, rồi ghi `log` một dòng tóm tắt lần lỗi này.
3. Nếu việc đang ở `xong` / `released` / `huy` mà test lại lỗi: `update <ID> --trang_thai=moi`, rồi `log` lý do mở lại.
4. Ca từng lỗi nay đã qua: tìm bằng `list --khoa_ngoai=…`, rồi `update <ID> --trang_thai=cho-duyet` và `log "Test đã qua"`. Không tự đặt `xong` hay `released`; người duyệt sẽ làm việc đó.

Cuối cùng báo người dùng danh sách id đã tạo mới, đã ghi thêm, đã mở lại, đã chuyển chờ duyệt.

## Khi cần chi tiết

Đọc `reference/API.md`. Tệp này có đủ endpoint REST, mọi trường (`lien_quan`, `can_phe_duyet`…), mã lỗi `400` / `401` / `404` / `409`, và ví dụ `curl`.
