#!/usr/bin/env node
// CLI cho Task Board API – không cần cài gói nào (Node ≥ 20). Chép tệp này sang project khác cũng chạy.
// Cần biến môi trường TM_API_URL và TM_API_TOKEN (tự đọc .env.local / .env ở thư mục hiện tại nếu có).
// TM_PROJECT (tuỳ chọn): mã dự án mặc định cho create / list / sprints, vd. SIA. Cờ --du_an ghi đè.
// Tài liệu đầy đủ: ../reference/API.md

import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f) && (!process.env.TM_API_URL || !process.env.TM_API_TOKEN)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

const HELP = `Dùng:
  tm me                                  tài khoản của token
  tm projects                            danh sách dự án (mã, tên, tiền tố id)
  tm sprints [--du_an=SIA]               danh sách đợt
  tm list [--du_an=SIA] [--trang_thai=moi,dang-lam] [--dot=…] [--mang=BE] [--uu_tien=P1] [--loai=loi]
          [--nguoi_lam=email|me|none] [--q=chữ] [--khoa_ngoai=…] [--gioi_han=200] [--json]
  tm get <ID>                            chi tiết, kèm nhật ký + bình luận
  tm create --tieu_de="…" --mang=BE [--du_an=SIA] [trường khác…]
  tm update <ID> [--trang_thai=xong] [trường khác…]
  tm comment <ID> "nội dung"
  tm log <ID> "một dòng nhật ký"

Trường: tieu_de mang loai dot uu_tien trang_thai uoc_luong mo_ta rui_ro nhanh_goi_y nguon nguoi_lam khoa_ngoai
Trường danh sách (lặp cờ để thêm nhiều dòng): bang_chung viec_can_lam tieu_chi_xong kiem_thu phu_thuoc
Dự án: --du_an hoặc biến TM_PROJECT; không có thì list/sprints lấy mọi dự án, create vào dự án mặc định.
Id việc: <MÃ>-<số> (SIA-019, SIA-010a), cấp tự động; id cũ BE-010… vẫn dùng được.
Tiêu đề: server tự thêm "[mang] " ở đầu – không cần gõ.
Giá trị "null" = xoá trường. Hoặc gửi nguyên JSON: --json-body='{"tieu_de":"…"}' / --file=viec.json`;

const LIST_FIELDS = ["bang_chung", "viec_can_lam", "tieu_chi_xong", "kiem_thu", "phu_thuoc"];

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    let [k, v] = a.slice(2).split(/=(.*)/s);
    if (v === undefined) v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    (flags[k] ??= []).push(v);
  }
  return { pos, flags };
}

async function bodyFromFlags(flags) {
  if (flags.file) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(flags.file[0], "utf8"));
  }
  if (flags["json-body"]) return JSON.parse(flags["json-body"][0]);
  const body = {};
  for (const [k, vs] of Object.entries(flags)) {
    if (k === "json") continue;
    if (LIST_FIELDS.includes(k)) body[k] = vs.filter((v) => v !== "null");
    else if (k === "lien_quan" || k === "can_phe_duyet") body[k] = vs[0] === "null" ? null : JSON.parse(vs[0]);
    else body[k] = vs[0] === "null" ? null : vs[0];
  }
  return body;
}

async function call(method, path, body) {
  const base = process.env.TM_API_URL?.replace(/\/$/, "");
  const token = process.env.TM_API_TOKEN;
  if (!base || !token) {
    console.error("Thiếu TM_API_URL hoặc TM_API_TOKEN (tạo token ở trang Tài khoản của Task Board).");
    process.exit(2);
  }
  const res = await fetch(base + "/api/v1" + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ loi: `HTTP ${res.status}` }));
  if (!res.ok) {
    console.error(`Lỗi ${res.status}: ${data.loi ?? ""}`);
    if (data.chi_tiet) console.error(JSON.stringify(data.chi_tiet, null, 2));
    process.exit(1);
  }
  return data;
}

const print = (x) => console.log(JSON.stringify(x, null, 2));
const { pos, flags } = parseArgs(process.argv.slice(2));
const [cmd, id, text] = pos;
// dự án mặc định từ môi trường cho lệnh chạy trong một dự án
if (process.env.TM_PROJECT && !flags.du_an && ["create", "list", "sprints"].includes(cmd)) {
  flags.du_an = [process.env.TM_PROJECT];
}

switch (cmd) {
  case "me":
    print(await call("GET", "/me"));
    break;
  case "projects":
    print(await call("GET", "/projects"));
    break;
  case "sprints":
    print(await call("GET", "/sprints" + (flags.du_an ? `?du_an=${encodeURIComponent(flags.du_an[0])}` : "")));
    break;
  case "list": {
    const qs = new URLSearchParams();
    for (const [k, vs] of Object.entries(flags)) if (k !== "json") qs.set(k, vs[0]);
    const data = await call("GET", "/tasks" + (qs.size ? `?${qs}` : ""));
    if (flags.json) print(data);
    else {
      for (const v of data.viec) {
        console.log(`${v.id.padEnd(12)} ${v.trang_thai.padEnd(9)} ${v.uu_tien} ${v.tieu_de}`);
      }
      console.log(`(${data.so_luong} việc)`);
    }
    break;
  }
  case "get":
    if (!id) throw new Error("Thiếu ID");
    print(await call("GET", `/tasks/${id}`));
    break;
  case "create": {
    const data = await call("POST", "/tasks", await bodyFromFlags(flags));
    console.error(data.tao_moi ? `Đã tạo ${data.viec.id}` : `Đã có ${data.viec.id} (cùng khoa_ngoai) – không tạo trùng`);
    print(data.viec);
    break;
  }
  case "update":
    if (!id) throw new Error("Thiếu ID");
    print(await call("PATCH", `/tasks/${id}`, await bodyFromFlags(flags)));
    break;
  case "comment":
    if (!id || !text) throw new Error("Dùng: tm comment <ID> \"nội dung\"");
    print(await call("POST", `/tasks/${id}/comments`, { noi_dung: text }));
    break;
  case "log":
    if (!id || !text) throw new Error("Dùng: tm log <ID> \"nội dung\"");
    print(await call("POST", `/tasks/${id}/logs`, { ghi: text }));
    break;
  default:
    console.log(HELP);
    process.exit(cmd ? 2 : 0);
}
