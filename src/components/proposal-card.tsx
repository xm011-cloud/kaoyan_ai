'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 提案类型（与 src/lib/proposals.ts 对应，客户端组件不引入 prisma 模块）
export interface ProposalItem {
  title: string;
  date: string;
  duration: number;
  subject?: string | null;
  description?: string | null;
}

export interface Proposal {
  proposalId: string;
  items: ProposalItem[];
  note?: string | null;
  createdAt?: string;
}

interface Props {
  proposal: Proposal;
  chatId: string | null;
  /** 处理完成（采纳/拒绝）后回调，由父组件移除该消息的提案卡并重存对话 */
  onHandled: () => void;
}

// 对话→任务落地：AI 批量建议的确认卡（逐项勾选 → 采纳/拒绝，直连 API 绕过 AI 循环）
export function ProposalCard({ proposal, chatId, onHandled }: Props) {
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(proposal.items.map((_, i) => i))
  );
  const [state, setState] = useState<'idle' | 'confirming' | 'rejecting'>('idle');
  const [error, setError] = useState('');

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectedItems = proposal.items.filter((_, i) => checked.has(i));

  const handleConfirm = async () => {
    if (!chatId || selectedItems.length === 0) return;
    setState('confirming');
    setError('');
    try {
      const res = await fetch('/api/chat/proposals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, proposalId: proposal.proposalId, items: selectedItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '采纳失败，请重试');
        setState('idle');
        return;
      }
      onHandled();
    } catch {
      setError('网络错误，请重试');
      setState('idle');
    }
  };

  const handleReject = async () => {
    if (!chatId) return;
    setState('rejecting');
    setError('');
    try {
      const res = await fetch('/api/chat/proposals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, proposalId: proposal.proposalId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '拒绝失败，请重试');
        setState('idle');
        return;
      }
      onHandled();
    } catch {
      setError('网络错误，请重试');
      setState('idle');
    }
  };

  const busy = state !== 'idle';

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">📋 任务提案</p>
        {proposal.note && (
          <span className="text-xs text-muted-foreground truncate">{proposal.note}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        AI 建议安排 {proposal.items.length} 个任务，确认后加入你的任务清单（可逐项勾选）
      </p>

      <div className="mt-2 space-y-1">
        {proposal.items.map((item, i) => (
          <label
            key={i}
            className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
              checked.has(i)
                ? 'border-brand/30 bg-brand-muted/40'
                : 'border-border/40 bg-transparent opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={checked.has(i)}
              onChange={() => toggle(i)}
              className="mt-0.5 accent-[var(--brand)]"
              disabled={busy}
            />
            <span className="min-w-0">
              <span className="block text-sm leading-snug">{item.title}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                {item.date}
                {item.duration ? ` · ${item.duration} 分钟` : ''}
                {item.subject ? ` · ${item.subject}` : ''}
              </span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="flex-1"
          disabled={busy || selectedItems.length === 0}
          onClick={handleConfirm}
        >
          {state === 'confirming' ? '采纳中...' : `采纳 ${selectedItems.length} 项`}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={handleReject}
        >
          {state === 'rejecting' ? '拒绝中...' : '拒绝'}
        </Button>
      </div>
    </div>
  );
}
