import React from 'react';
import { Flame, Trash2, Check, Clock, X, Star, ShieldCheck } from 'lucide-react';

export function StatusBadge({ status, rejectionReason }) {
  const s = (status || 'unverified').toLowerCase();
  
  if (s === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-[#DC2626] text-white shadow-xs">
        <Check className="w-3.5 h-3.5 stroke-[3]" />
        Confirmed
      </span>
    );
  }
  
  if (s === 'unverified') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-[#F59E0B] text-slate-950 shadow-xs">
        <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
        Pending Review
      </span>
    );
  }

  if (s === 'rejected') {
    return (
      <span 
        title={rejectionReason ? `Reason: ${rejectionReason}` : 'Rejected report'}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-semibold bg-slate-700 text-slate-200 border border-slate-600"
      >
        <X className="w-3.5 h-3.5 stroke-[2.5]" />
        Rejected {rejectionReason ? `(${rejectionReason.replace('_', ' ')})` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-[#16A34A] text-white shadow-xs">
      <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
      Safe Zone
    </span>
  );
}

export function ConfidenceBadge({ classification, confidence }) {
  const c = (classification || 'unknown').toLowerCase();
  const pct = Math.round((confidence || 0) * 100);

  if (c === 'open_burning' || c === 'fire') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-red-100 text-red-900 border border-red-300">
        <Flame className="w-3.5 h-3.5 text-[#DC2626] fill-current" />
        {pct}% Open Burning
      </span>
    );
  }

  if (c === 'waste_pile') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
        <Trash2 className="w-3.5 h-3.5 text-[#D97706]" />
        {pct}% Waste Pile
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-element text-xs font-bold bg-green-100 text-green-900 border border-green-300">
      <Check className="w-3.5 h-3.5 text-[#16A34A] stroke-[3]" />
      {pct}% Clear
    </span>
  );
}

export function TrustScoreChip({ score = 10 }) {
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (score >= 40) color = "bg-green-50 text-green-700 border-green-200";
  else if (score >= 15) color = "bg-sky-50 text-sky-700 border-sky-200";
  else if (score < 5) color = "bg-red-50 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-element text-xs font-semibold border ${color}`}>
      <Star className="w-3 h-3 fill-current opacity-75" />
      Trust {score}
    </span>
  );
}
