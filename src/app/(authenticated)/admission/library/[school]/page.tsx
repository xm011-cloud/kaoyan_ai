import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrichRowsForUniversity, type AdmissionEntryView } from "@/lib/admission-server";
import { SchoolDetailView } from "@/components/admission/school-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ school: string }>;
}): Promise<Metadata> {
  const { school } = await params;
  const uni = decodeURIComponent(school);
  return { title: `${uni} · 院校情报`, robots: { index: false, follow: false } };
}

// 院校详情页（社区知识库共享视图，可分享链接，仅登录用户可看）
// 数据流：全局行(userId:null) → 增强(计数) → 按专业分组交给 client 视图聚合渲染。
export default async function SchoolLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ major?: string; year?: string; category?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { school } = await params;
  const sp = await searchParams;
  const uni = decodeURIComponent(school);

  const { entries } = await enrichRowsForUniversity(uni, user.id, {
    major: sp.major,
    year: sp.year ? Number(sp.year) : undefined,
    category: sp.category,
  });

  // 按专业分组（保留条目顺序），交给 client 聚合 + 反馈
  const majors: Record<string, AdmissionEntryView[]> = {};
  for (const e of entries) {
    (majors[e.major] ||= []).push(e);
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <SchoolDetailView university={uni} majors={majors} />
    </div>
  );
}
