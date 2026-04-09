// 루트 접근 시 /portal 로 리다이렉트
// 미들웨어에서 비로그인이면 /login 으로 처리함
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/portal");
}
