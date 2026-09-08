"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useStudyContext } from "@/components/study-context";
import { useAiWorkspace } from "@/components/ai-workspace-context";

type Material = { id: string; name: string; type: string; url: string };
type Note = { id: string; content: string; kind: string; createdAt: string };
type Session = { id: string; status: string; startedAt: string; endedAt?: string | null; selfAssessment?: string | null };
type Lesson = {
  id: string; title: string; order: number; sourceType: string; sourceUrl?: string | null;
  plannedMinutes?: number | null; status: string; material?: Material | null;
  sessions: Session[]; _count: { notes: number };
};
type Unit = { id: string; title: string; order: number; lessons: Lesson[] };
type Course = {
  id: string; title: string; subject?: string | null; description?: string | null;
  sourceType: string; sourceUrl?: string | null; status: string; updatedAt: string;
  lessonCount?: number; units?: Unit[];
};

const NOTE_TYPES = [
  { value: "note", label: "笔记" },
  { value: "key_point", label: "重点" },
  { value: "question", label: "疑问" },
  { value: "error", label: "易错点" },
];

function sourceLabel(lesson: Lesson) {
  if (lesson.sourceType === "external") return "外部课程链接";
  if (lesson.sourceType === "material") return lesson.material?.name || "关联资料";
  return "手动学习单元";
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ session: Session; lesson: Lesson } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteKind, setNoteKind] = useState("note");
  const [saving, setSaving] = useState(false);
  const { setContext } = useStudyContext();
  const aiWorkspace = useAiWorkspace();

  const loadCourse = useCallback(async (id: string) => {
    const res = await fetch(`/api/courses/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载课程详情失败");
    setSelected(data.course);
  }, []);

  const loadCourses = useCallback(async (selectId?: string) => {
    const res = await fetch("/api/courses", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载课程失败");
    const list = data.courses || [];
    setCourses(list);
    const id = selectId || selected?.id || list[0]?.id;
    if (id) await loadCourse(id);
    else setSelected(null);
  }, [loadCourse, selected?.id]);

  useEffect(() => {
    // 初次加载只同步远端课程数据；后续选择课程由显式交互触发。
    Promise.all([
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCourses(),
      fetch("/api/materials?brief=1", { cache: "no-store" }).then((res) => res.json()).then((data) => setMaterials(data.materials || [])),
    ]).catch((err: unknown) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [loadCourses]);

  const allLessons = useMemo(() => selected?.units?.flatMap((unit) => unit.lessons) || [], [selected]);
  const completedLessons = allLessons.filter((lesson) => lesson.status === "completed").length;

  useEffect(() => {
    const lesson = activeSession?.lesson ?? allLessons.find((item) => item.status === "in_progress") ?? allLessons[0];
    if (!selected || !lesson) {
      setContext(null);
      return;
    }
    const unit = selected.units?.find((item) => item.id === lesson.id || item.lessons.some((item) => item.id === lesson.id));
    setContext({
      kind: "course_lesson",
      courseId: selected.id,
      lessonId: lesson.id,
      title: `${selected.title} · ${lesson.title}`,
      detail: unit?.title || "当前课时",
      noteCount: lesson._count.notes,
    });
    return () => setContext(null);
  }, [activeSession, allLessons, selected, setContext]);

  const createCourse = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"), subject: fd.get("subject"), sourceUrl: fd.get("sourceUrl"),
          sourceType: fd.get("sourceUrl") ? "external" : "manual", firstLessonTitle: fd.get("firstLessonTitle"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建课程失败");
      setCreateOpen(false);
      await loadCourses(data.course.id);
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
    finally { setSaving(false); }
  };

  const addLesson = async (form: HTMLFormElement) => {
    if (!selected) return;
    const fd = new FormData(form);
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/courses/${selected.id}/lessons`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: fd.get("unitId") || undefined, unitTitle: fd.get("unitTitle"), lessonTitle: fd.get("lessonTitle"),
          sourceType: fd.get("sourceType"), sourceUrl: fd.get("sourceUrl"), materialId: fd.get("materialId") || undefined,
          plannedMinutes: Number(fd.get("plannedMinutes")) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加课时失败");
      setAddLessonOpen(false);
      await loadCourse(selected.id);
      await loadCourses(selected.id);
    } catch (err) { setError(err instanceof Error ? err.message : "添加失败"); }
    finally { setSaving(false); }
  };

  const startLesson = async (lesson: Lesson) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "无法开始学习");
      setActiveSession({ session: data.session, lesson });
      const noteRes = await fetch(`/api/study-notes?lessonId=${lesson.id}`);
      const noteData = await noteRes.json();
      setNotes(noteData.notes || []);
      await loadCourse(selected!.id);
    } catch (err) { setError(err instanceof Error ? err.message : "无法开始学习"); }
    finally { setSaving(false); }
  };

  const saveNote = async () => {
    if (!activeSession || !noteContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/study-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent, kind: noteKind, studySessionId: activeSession.session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存笔记失败");
      setNotes((current) => [...current, data.note]);
      setNoteContent("");
    } catch (err) { setError(err instanceof Error ? err.message : "保存笔记失败"); }
    finally { setSaving(false); }
  };

  const finishSession = async (form: HTMLFormElement) => {
    if (!activeSession) return;
    const fd = new FormData(form);
    const minutes = Math.max(1, Math.round((Date.now() - new Date(activeSession.session.startedAt).getTime()) / 60000));
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/study-sessions/${activeSession.session.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", selfAssessment: fd.get("assessment"), blocker: fd.get("blocker"), nextStep: fd.get("nextStep"), actualMinutes: minutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "结束学习失败");
      setActiveSession(null);
      if (selected) { await loadCourse(selected.id); await loadCourses(selected.id); }
    } catch (err) { setError(err instanceof Error ? err.message : "结束学习失败"); }
    finally { setSaving(false); }
  };

  return (
    <>
    <div className={`workspace-page ${activeSession ? "hidden" : ""}`}>
      <div className="mx-auto max-w-6xl space-y-7">
        <PageHeader
          title="我的课程"
          subtitle="把已有课程、资料和课时接进你的备考路线；C6 不托管未经授权的课程内容。"
          action={<Button onClick={() => setCreateOpen(true)}>添加课程</Button>}
        />
        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-2 lg:sticky lg:top-3 lg:self-start">
            <p className="px-1 text-xs font-medium text-muted-foreground">正在学习</p>
            {loading ? <p className="p-3 text-sm text-muted-foreground">加载中...</p> : courses.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">从一门正在跟的课开始，不需要导入整套课程。</div>
            ) : courses.map((course) => (
              <button key={course.id} onClick={() => loadCourse(course.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === course.id ? "border-brand/40 bg-brand/5" : "border-border/50 bg-card hover:bg-muted/50"}`}>
                <p className="truncate text-sm font-medium">{course.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{course.subject || "未分类"} · {course.lessonCount || 0} 节课</p>
              </button>
            ))}
          </aside>

          <section className="workspace-surface min-w-0 overflow-hidden">
            {!selected ? (
              <div className="p-10 text-center"><p className="text-lg font-semibold">先接入你正在学的一门课程</p><p className="mt-2 text-sm text-muted-foreground">可以是一条课程链接、一份讲义，或一个你手动整理的课时。</p><Button className="mt-5" onClick={() => setCreateOpen(true)}>添加第一门课程</Button></div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 p-5">
                  <div><p className="text-xs text-brand">{selected.subject || "课程学习"}</p><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.description || "课程进度、笔记和自评会留在这里。"}</p></div>
                  <div className="text-right"><p className="text-sm font-medium">{completedLessons} / {allLessons.length} 节已完成</p><p className="mt-1 text-xs text-muted-foreground">完成代表学完；掌握仍需练习验证</p></div>
                </div>
                <div className="space-y-5 p-5">
                  {selected.units?.map((unit) => <div key={unit.id} className="space-y-2">
                    <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">第 {unit.order} 章</span><h3 className="font-medium">{unit.title}</h3></div>
                    {unit.lessons.map((lesson) => <div key={lesson.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-3">
                      <span className={`h-2 w-2 rounded-full ${lesson.status === "completed" ? "bg-success" : lesson.status === "in_progress" ? "bg-warning" : "bg-muted-foreground/30"}`} />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{lesson.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{sourceLabel(lesson)}{lesson.plannedMinutes ? ` · ${lesson.plannedMinutes} 分钟` : ""} · {lesson._count.notes} 条学习记录</p></div>
                      <Button size="sm" variant={lesson.status === "completed" ? "outline" : "default"} onClick={() => startLesson(lesson)} disabled={saving}>{lesson.status === "completed" ? "回顾" : lesson.status === "in_progress" ? "继续" : "开始"}</Button>
                    </div>)}
                  </div>)}
                  {allLessons.length === 0 && <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">这门课程还没有课时。先添加下一节正在学的内容即可。</p>}
                  <Button variant="outline" onClick={() => setAddLessonOpen(true)}>＋ 添加章节或课时</Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {createOpen && <Modal open onClose={() => setCreateOpen(false)} title="添加一门正在学的课程" footer={<><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button type="submit" form="create-course" disabled={saving}>{saving ? "创建中..." : "创建课程"}</Button></>}>
        <form id="create-course" className="space-y-3" onSubmit={(e) => { e.preventDefault(); createCourse(e.currentTarget); }}>
          <input name="title" required placeholder="课程名称，例如：王道计算机网络" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <input name="subject" placeholder="科目，例如：408 / 数学一" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <input name="firstLessonTitle" placeholder="第一节要学习什么（可选）" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <input name="sourceUrl" type="url" placeholder="课程或课时链接（可选，仅保存入口）" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <p className="text-xs text-muted-foreground">链接只作为学习入口保存；请确保你对课程内容拥有合法访问权。</p>
        </form>
      </Modal>}

      {addLessonOpen && selected && <Modal open onClose={() => setAddLessonOpen(false)} title="添加课时" footer={<><Button variant="outline" onClick={() => setAddLessonOpen(false)}>取消</Button><Button type="submit" form="add-lesson" disabled={saving}>{saving ? "保存中..." : "添加课时"}</Button></>}>
        <form id="add-lesson" className="space-y-3" onSubmit={(e) => { e.preventDefault(); addLesson(e.currentTarget); }}>
          <select name="unitId" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" defaultValue=""><option value="">新建章节（在下方填写名称）</option>{selected.units?.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select>
          <input name="unitTitle" placeholder="新章节名称（选择已有章节时留空）" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <input name="lessonTitle" required placeholder="课时名称，例如：2.1 传输层服务" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3"><select name="sourceType" className="rounded-xl border bg-muted/40 px-3 py-2 text-sm" defaultValue="manual"><option value="manual">手动学习单元</option><option value="external">外部课程链接</option><option value="material">关联已有资料</option></select><input name="plannedMinutes" type="number" min="1" max="600" placeholder="预计分钟（可选）" className="rounded-xl border bg-muted/40 px-3 py-2 text-sm" /></div>
          <input name="sourceUrl" type="url" placeholder="外部课时链接（可选）" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" />
          <select name="materialId" className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" defaultValue=""><option value="">不关联资料</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select>
        </form>
      </Modal>}

    </div>

      {activeSession && <div className="min-h-full bg-background p-4 lg:p-8">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="workspace-surface min-w-0 p-5 lg:p-7">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/60 pb-5"><div><p className="text-xs font-medium text-brand">正在学习</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{activeSession.lesson.title}</h1><p className="mt-1 text-sm text-muted-foreground">学习、记录和复盘都留在这个现场。</p></div><Button variant="outline" size="sm" onClick={() => setActiveSession(null)}>返回课程</Button></div>
        <div className="space-y-5">
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm"><p className="font-medium">本次学习会话已开始</p><p className="mt-1 text-muted-foreground">先学习，再留下重点、疑问或易错点；结束时再判断这节课是否需要练习。</p>{activeSession.lesson.sourceUrl && <a href={activeSession.lesson.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">打开课程来源 ↗</a>}</div>
          <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">学习记录</h3><select value={noteKind} onChange={(e) => setNoteKind(e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-xs">{NOTE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div><textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={4} placeholder="写下自己的理解、疑问或易错点…" className="w-full rounded-xl border bg-muted/40 p-3 text-sm" /><div className="mt-2 text-right"><Button size="sm" onClick={saveNote} disabled={saving || !noteContent.trim()}>保存记录</Button></div><div className="mt-3 space-y-2">{notes.map((note) => <div key={note.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="mr-2 text-xs text-brand">{NOTE_TYPES.find((type) => type.value === note.kind)?.label || "笔记"}</span>{note.content}</div>)}</div></div>
          <form className="border-t pt-4" onSubmit={(e) => { e.preventDefault(); finishSession(e.currentTarget); }}><h3 className="text-sm font-medium">结束这次学习</h3><p className="mt-1 text-xs text-muted-foreground">“完成”只记录本节学完，不会自动认定为已经掌握。</p><select required name="assessment" defaultValue="" className="mt-3 w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm"><option value="" disabled>这节课现在的状态是？</option><option value="clear">能复述核心内容</option><option value="needs_practice">大致听懂，需要练习</option><option value="blocked">有明显卡点</option></select><textarea name="blocker" rows={2} placeholder="卡在哪里？（可选）" className="mt-2 w-full rounded-xl border bg-muted/40 p-3 text-sm" /><input name="nextStep" placeholder="下次从哪里继续？（可选）" className="mt-2 w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm" /><div className="mt-3 text-right"><Button type="submit" disabled={saving}>{saving ? "保存中..." : "完成并保存学习证据"}</Button></div></form>
        </div></section>
          <aside className="workspace-surface self-start p-5 lg:sticky lg:top-5"><p className="workspace-kicker text-brand">学习节奏</p><h2 className="mt-1 font-semibold">这一次只做一件事</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">先完成当前课时，再根据自评决定是否练习。AI 会带上本课时、最近笔记与卡点。</p><Button variant="outline" size="sm" className="mt-4" onClick={() => aiWorkspace.requestHelp(`我正在学习「${activeSession.lesson.title}」。请先根据当前课时帮我明确这次学习的最小目标。`)}>让 AI 协助本课</Button>{activeSession.lesson.sourceUrl && <a href={activeSession.lesson.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90">打开课程来源 ↗</a>}<div className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">完成课程不等于掌握；需要练习的内容会在结束时保留为下一步。</div></aside>
        </div>
      </div>}
    </>
  );
}
