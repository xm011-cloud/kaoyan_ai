import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取已保存的院校录取数据
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const university = searchParams.get("university");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {
    userId: user!.id,
  };
  if (university) where.university = { contains: university };
  if (year) where.year = parseInt(year);

  const records = await prisma.admissionInfo.findMany({
    where,
    orderBy: [{ university: "asc" }, { year: "desc" }],
  });

  // Group by university + major
  const grouped: Record<
    string,
    { university: string; major: string; years: Record<number, typeof records> }
  > = {};
  for (const r of records) {
    const key = `${r.university}::${r.major}`;
    if (!grouped[key]) {
      grouped[key] = { university: r.university, major: r.major, years: {} };
    }
    if (!grouped[key].years[r.year]) {
      grouped[key].years[r.year] = [];
    }
    grouped[key].years[r.year].push(r);
  }

  return NextResponse.json({
    records,
    grouped: Object.values(grouped),
  });
}

// POST: 保存录取数据
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { university, major, year, category, data, source } = body;

  if (!university || !major || !year || !category) {
    return NextResponse.json(
      { error: "university, major, year, category 为必填" },
      { status: 400 }
    );
  }

  if (typeof year !== "number" || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "年份无效" }, { status: 400 });
  }

  const record = await prisma.admissionInfo.upsert({
    where: {
      university_major_year_category: {
        university,
        major,
        year,
        category,
      },
    },
    create: {
      userId: user!.id,
      university,
      major,
      year,
      category,
      data: data || {},
      source: source || "",
    },
    update: {
      data: data || {},
      source: source || "",
    },
  });

  return NextResponse.json({ record });
}

// DELETE: 删除已保存的录取数据
export async function DELETE(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
  }

  const record = await prisma.admissionInfo.findFirst({
    where: { id, userId: user!.id },
  });
  if (!record) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  await prisma.admissionInfo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
