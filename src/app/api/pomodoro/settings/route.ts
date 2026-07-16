import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET: 获取番茄钟设置
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      pomodoroFocusMinutes: true,
      pomodoroShortBreakMinutes: true,
      pomodoroLongBreakMinutes: true,
      pomodoroLongBreakInterval: true,
    },
  });

  return NextResponse.json({
    focusMinutes: dbUser?.pomodoroFocusMinutes ?? 25,
    shortBreakMinutes: dbUser?.pomodoroShortBreakMinutes ?? 5,
    longBreakMinutes: dbUser?.pomodoroLongBreakMinutes ?? 15,
    longBreakInterval: dbUser?.pomodoroLongBreakInterval ?? 4,
  });
}

// PUT: 更新番茄钟设置
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakInterval } = body;

  // 验证
  if (focusMinutes !== undefined && (focusMinutes < 1 || focusMinutes > 120)) {
    return NextResponse.json(
      { error: "专注时长需在 1-120 分钟之间" },
      { status: 400 }
    );
  }
  if (shortBreakMinutes !== undefined && (shortBreakMinutes < 1 || shortBreakMinutes > 30)) {
    return NextResponse.json(
      { error: "短休息时长需在 1-30 分钟之间" },
      { status: 400 }
    );
  }
  if (longBreakMinutes !== undefined && (longBreakMinutes < 1 || longBreakMinutes > 60)) {
    return NextResponse.json(
      { error: "长休息时长需在 1-60 分钟之间" },
      { status: 400 }
    );
  }
  if (longBreakInterval !== undefined && (longBreakInterval < 1 || longBreakInterval > 10)) {
    return NextResponse.json(
      { error: "长休息间隔需在 1-10 个番茄之间" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user!.id },
    data: {
      ...(focusMinutes !== undefined && { pomodoroFocusMinutes: focusMinutes }),
      ...(shortBreakMinutes !== undefined && { pomodoroShortBreakMinutes: shortBreakMinutes }),
      ...(longBreakMinutes !== undefined && { pomodoroLongBreakMinutes: longBreakMinutes }),
      ...(longBreakInterval !== undefined && { pomodoroLongBreakInterval: longBreakInterval }),
    },
  });

  return NextResponse.json({ success: true });
}
