# Task Board

Quản lý backlog kỹ thuật kiểu Jira, dựa trên cấu trúc `backlog.json` (Siroby Kids).
Next.js 16 (App Router, Server Actions) · Drizzle ORM · Postgres (Neon) · Vercel.

## Tính năng

- **Dự án**: mỗi dự án là một backlog riêng (đợt, việc, AR/QD, import / export riêng); đổi dự án ở góc trên thanh bên. Quản trị viên thêm dự án ở **Quản trị → Dự án**. Dự án đầu tiên `SIA` (SirobyApp) giữ id cũ `BE-001`; dự án thêm sau có id kèm mã, vd. `ABC-BE-001`. Người dùng dùng chung mọi dự án.
- **Bảng** kéo thả theo trạng thái (`moi → san-sang → dang-lam → cho-duyet → xong`, cột `huy` ẩn/hiện). Mỗi lần đổi trạng thái hoặc người làm tự thêm một dòng `nhat_ky`.
- **Backlog** nhóm theo đợt (`dot`), sắp theo ưu tiên; lọc theo đợt / mảng / ưu tiên / loại / người làm, tìm theo id, tiêu đề, mô tả.
- **Chi tiết việc**: đủ mọi trường của `viec` (bằng chứng, việc cần làm, tiêu chí xong, kiểm thử, rủi ro, cần phê duyệt, phụ thuộc, liên quan…), bình luận, nhật ký. Id dạng `BE-001`, `QD-002` trong văn bản tự thành liên kết.
- **Tạo việc**: id cấp tự động theo `dem_id` của mảng (BE/FE/OPS/DOC).
- **Đợt**, **Rủi ro đã chấp nhận (AR)**, **Chờ quyết định (QD)**, ghi chú ngoài phạm vi.
- **Import** `backlog.json` (gộp hoặc thay toàn bộ) và **Export** ra đúng cấu trúc cũ. Import rồi export ngay thì ra tệp giống hệt tệp gốc. Export thêm trường `nguoi_lam` (email) cho việc đã giao; bình luận không nằm trong tệp.
- **Người dùng**: không có đăng ký công khai. Quản trị viên tạo link mời (dùng 1 lần, hạn 7 ngày) rồi copy gửi qua Zalo / Slack. Người được mời đặt tên + mật khẩu, lần sau đăng nhập bằng email + mật khẩu. Mời lại một email đã có thì thành link đặt lại mật khẩu. Hai quyền: Quản trị / Thành viên. Khoá tài khoản thì người đó bị đăng xuất ngay.

- **API + CLI** cho project khác: token cá nhân (trang Tài khoản), REST `/api/v1`, chống tạo trùng bằng `khoa_ngoai`. Tất cả đóng gói trong skill [.claude/skills/task-board](.claude/skills/task-board/SKILL.md) (CLI + [tài liệu API](.claude/skills/task-board/reference/API.md)) – chép nguyên thư mục đó vào `.claude/skills/` của project khác.

## Triển khai lần đầu (Vercel + Neon)

1. **Neon**: tạo project, copy connection string.
2. **Tạo bảng** (chạy trên máy, một lần, và mỗi lần đổi schema):
   ```bash
   npm install
   echo 'DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require' > .env.local
   npm run db:migrate
   ```
3. **Vercel**: import repo, đặt biến môi trường
   - `DATABASE_URL`: chuỗi Neon (nên dùng bản pooled `-pooler`). Nếu dùng tích hợp Neon trên Vercel thì biến này được điền sẵn.
   - `SETUP_SECRET`: chuỗi ngẫu nhiên (`openssl rand -base64 24`).
4. Mở `https://<app>/setup`, nhập `SETUP_SECRET` để tạo quản trị viên đầu tiên. Trang này chỉ dùng được khi DB chưa có người dùng nào.
5. Vào **Import / Export** để nạp `backlog.json`, rồi vào **Người dùng** để mời mọi người.

## Chạy trên máy

```bash
cp .env.example .env.local   # điền DATABASE_URL (Neon, hoặc Postgres local) + SETUP_SECRET
npm run db:migrate
npm run dev
```

`src/db/index.ts` dùng `pg` (node-postgres) + `attachDatabasePool` của `@vercel/functions`, theo khuyến nghị của Neon cho Vercel Fluid compute. App dùng `DATABASE_URL` (pooled); `drizzle-kit` dùng `DATABASE_URL_UNPOOLED` (direct) khi có.

Neon CLI: `neon.ts` + `.neon` liên kết project; `neon deploy` / `neon env pull` ghi `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH` vào `.env.local`.

## Đổi schema

Sửa `src/db/schema.ts`, rồi chạy `npm run db:generate` (sinh tệp SQL trong `drizzle/`, nhớ commit tệp đó) và `npm run db:migrate`.

Migrate lên production (chuỗi Neon production nằm trong `.env.prod`, không commit) – **trước** khi push code mới để Vercel deploy:

```bash
set -a && . ./.env.prod && set +a && npm run db:migrate
```

## Cấu trúc

```
src/db/schema.ts        bảng: users, sessions, invites, tasks, task_logs, comments, sprints, counters, records (AR/QD), meta
src/lib/backlog.ts      import / export backlog.json, cấp id
src/lib/auth.ts         phiên (cookie httpOnly, DB lưu sha256), bcrypt
src/app/actions/        server actions (auth, admin, tasks)
src/app/(app)/          các trang cần đăng nhập
src/app/(auth)/         login, setup, invite/[token]
src/proxy.ts            chưa có cookie thì chuyển về /login
```
