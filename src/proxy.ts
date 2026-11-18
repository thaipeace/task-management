import { NextResponse, type NextRequest } from "next/server";

// Kiểm tra lạc quan: chưa có cookie phiên thì đưa về trang đăng nhập.
// Quyền thật được kiểm lại ở từng trang / server action.
// /api/v1 tự xác thực bằng Bearer token, không dùng cookie
const PUBLIC = ["/login", "/setup", "/invite/", "/api/v1/"];

// /SIA/board, /SIS/report/weekly… – nhớ dự án dùng gần nhất (cookie chỉ để chuyển đường dẫn cũ, không quyết định trang đang xem)
const PROJECT_PATH = /^\/([A-Za-z][A-Za-z0-9]{1,9})\/(board|backlog|sprints|goals|records|report|tasks\/new)(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (!request.cookies.has("tm_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const res = NextResponse.next();
  const m = PROJECT_PATH.exec(pathname);
  if (m && request.cookies.get("tm_project")?.value !== m[1].toUpperCase()) {
    res.cookies.set("tm_project", m[1].toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 86_400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
