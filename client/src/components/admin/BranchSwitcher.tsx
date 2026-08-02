/**
 * BranchSwitcher — shows which POS branch the current staff session is
 * operating at, and lets them switch when more than one branch exists.
 *
 * With a single active branch (today's reality — Brass Store only), this
 * silently self-heals the user's activeBranchId and renders as a static
 * label, so there's zero extra friction. Once a second branch exists, it
 * becomes a real dropdown.
 */
import { useEffect, useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Store, ChevronDown, Check } from 'lucide-react';

export default function BranchSwitcher({ activeBranchId }: { activeBranchId: number | null | undefined }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: branches } = trpc.pos.branches.useQuery();

  const setActiveBranch = trpc.pos.setActiveBranch.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  // Self-heal: if there's no active branch selected yet but exactly one
  // active branch exists, select it automatically — keeps single-branch
  // operation (Cove's current reality) completely frictionless.
  useEffect(() => {
    if (!branches || branches.length === 0) return;
    const stillValid = branches.some(b => b.id === activeBranchId);
    if (stillValid) return;
    if (branches.length === 1) {
      setActiveBranch.mutate({ branchId: branches[0].id });
    }
  }, [branches, activeBranchId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!branches || branches.length === 0) return null;

  const current = branches.find(b => b.id === activeBranchId) ?? branches[0];

  // Single branch: static label, no dropdown noise.
  if (branches.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded" style={{ backgroundColor: 'rgba(157,125,57,0.08)' }}>
        <Store size={13} style={{ color: '#9D7D39' }} />
        <span className="text-[10px] font-semibold tracking-wider uppercase truncate" style={{ color: 'rgba(250,250,248,0.6)', fontFamily: 'Montserrat, sans-serif' }}>
          {current.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative px-3 mb-2" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={setActiveBranch.isPending}
        className="flex items-center gap-2 w-full py-2 px-2 rounded transition-colors"
        style={{ backgroundColor: 'rgba(157,125,57,0.1)' }}
      >
        <Store size={13} style={{ color: '#9D7D39' }} />
        <span className="text-[10px] font-semibold tracking-wider uppercase truncate flex-1 text-left" style={{ color: 'rgba(250,250,248,0.7)', fontFamily: 'Montserrat, sans-serif' }}>
          {current.name}
        </span>
        <ChevronDown size={12} style={{ color: 'rgba(250,250,248,0.4)' }} />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 mt-1 py-1 rounded shadow-lg z-10"
          style={{ backgroundColor: '#1a1918', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => {
                setActiveBranch.mutate({ branchId: b.id });
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5"
            >
              <span className="text-[10px] font-semibold tracking-wider uppercase flex-1" style={{ color: 'rgba(250,250,248,0.7)', fontFamily: 'Montserrat, sans-serif' }}>
                {b.name}
              </span>
              {b.id === current.id && <Check size={12} style={{ color: '#9D7D39' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
