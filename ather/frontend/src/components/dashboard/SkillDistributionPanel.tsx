"use client";

/**
 * SkillDistributionPanel
 * ─────────────────────────────────────────────────────────────
 * Replaces the SVG radar chart with four richer panels:
 *
 * 1. Top stat tiles  — overall score, strongest skill, biggest gap, salary unlock
 * 2. Left  panel     — horizontal colour-coded bar chart for all skills
 * 3. Right panel     — priority gap cards with mini bar + salary impact + % of postings
 * 4. Bottom table    — job coverage matrix (skill × job role)
 */

import { useStore } from "@/store";
import { Card, CardContent } from "@/components/ui/Card";
import { scoreColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SkillGap, JobMatch, RadarData } from "@/types";

// ── Colour helpers ────────────────────────────────────────────

function barColor(score: number) {
  if (score >= 65) return "#2a78d6";   // strong — blue
  if (score >= 45) return "#d97706";   // fair   — amber
  if (score >= 30) return "#ea7040";   // weak   — coral
  return "#dc2626";                     // gap    — red
}

function barLabel(score: number) {
  if (score >= 65) return { text: "Strong",    cls: "text-blue-600 dark:text-blue-400" };
  if (score >= 45) return { text: "Fair",      cls: "text-amber-600 dark:text-amber-400" };
  if (score >= 30) return { text: "Weak",      cls: "text-orange-500 dark:text-orange-400" };
  return           { text: "Critical gap", cls: "text-red-600 dark:text-red-400" };
}

const PRIORITY_PILL: Record<string, string> = {
  "BLOCKER":      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "HIGH IMPACT":  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "HIGH":         "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "MODERATE":     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "NICE TO HAVE": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

// ── Sub-components ────────────────────────────────────────────

function StatTile({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-base font-semibold leading-tight" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function SkillBar({ name, score }: { name: string; score: number }) {
  const color = barColor(score);
  const { text, cls } = barLabel(score);
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0 truncate">{name}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold w-6 text-right flex-shrink-0" style={{ color }}>{score}</span>
    </div>
  );
}

function GapCard({ gap }: { gap: SkillGap }) {
  const pillCls = PRIORITY_PILL[gap.priority] ?? PRIORITY_PILL["MODERATE"];
  const score = parseInt(gap.jobsRequiring) || 0;

  return (
    <div className="p-3 rounded-xl border border-gray-100 dark:border-zinc-800 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", pillCls)}>
            {gap.priority}
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{gap.skill}</p>
        </div>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
          {gap.salaryImpact}
        </span>
      </div>

      {/* Mini progress bar */}
      <div>
        <div className="h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${score}%`, background: barColor(score - 30) }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
        <span>📋 {gap.jobsRequiring} of postings</span>
        <span>⏱ {gap.timeToLearn}</span>
      </div>

      {gap.resources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {gap.resources.slice(0, 3).map((r) => (
            <span key={r} className="text-[10px] px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageTable({ jobs, skills }: { jobs: JobMatch[]; skills: string[] }) {
  const THRESHOLD = 60;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100 dark:border-zinc-800">
            <th className="text-left py-2 pr-3 text-gray-400 font-medium w-32">Skill</th>
            {jobs.slice(0, 4).map((j) => (
              <th key={j.title} className="text-center py-2 px-2 font-medium" style={{ color: scoreColor(j.match) }}>
                <span className="block truncate max-w-[80px]">{j.title.split(" ").slice(0, 2).join(" ")}</span>
                <span className="text-[10px] font-normal text-gray-400">{j.match}% match</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr key={skill} className="border-b border-gray-50 dark:border-zinc-800/50">
              <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 truncate max-w-[128px]">{skill}</td>
              {jobs.slice(0, 4).map((j) => {
                const isMissing = j.missing.some(
                  (m) => skill.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(skill.toLowerCase().split(" ")[0])
                );
                const isRequired = !isMissing && j.match >= THRESHOLD;
                return (
                  <td key={j.title} className="text-center py-2 px-2">
                    {isMissing ? (
                      <span className="text-red-500 font-bold text-sm">✕</span>
                    ) : isRequired ? (
                      <span className="text-emerald-500 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-gray-300 dark:text-zinc-600 text-sm">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-emerald-500 font-bold">✓</span> Meets requirement
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-red-500 font-bold">✕</span> Below threshold / missing
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-gray-300">—</span> Not required for this role
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  radar: RadarData;
  skillGaps: SkillGap[];
  jobs: JobMatch[];
  overallScore: number;
}

export function SkillDistributionPanel({ radar, skillGaps, jobs, overallScore }: Props) {
  // Build skill list from radar data
  const skills = radar.labels.map((label, i) => ({ name: label, score: radar.values[i] }));

  // Derive stat tile values
  const strongest = [...skills].sort((a, b) => b.score - a.score)[0];
  const weakest   = [...skills].sort((a, b) => a.score - b.score)[0];
  const totalSalaryUnlock = skillGaps
    .filter((g) => g.priority === "BLOCKER" || g.priority === "HIGH IMPACT")
    .reduce((sum, g) => {
      const n = parseInt(g.salaryImpact.replace(/[^0-9]/g, "")) || 0;
      return sum + n;
    }, 0);

  return (
    <div className="space-y-4">
      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Overall score"
          value={`${overallScore} / 100`}
          sub="Based on your full profile"
          color={scoreColor(overallScore)}
        />
        <StatTile
          label="Strongest skill"
          value={strongest.name}
          sub={`${strongest.score} / 100 — top quartile`}
          color="#2a78d6"
        />
        <StatTile
          label="Biggest gap"
          value={weakest.name}
          sub={`${weakest.score} / 100 — needs attention`}
          color="#dc2626"
        />
        <StatTile
          label="Salary unlock potential"
          value={`+$${totalSalaryUnlock}k avg`}
          sub="if priority gaps are closed"
          color="#10b981"
        />
      </div>

      {/* ── Bar chart + Gap cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Horizontal bar chart */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500" />
              Current skill proficiency
            </h3>
            <div className="space-y-3">
              {skills.map(({ name, score }) => (
                <SkillBar key={name} name={name} score={score} />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
              {[
                { color: "#2a78d6", label: "Strong (65+)" },
                { color: "#d97706", label: "Fair (45–64)" },
                { color: "#ea7040", label: "Weak (30–44)" },
                { color: "#dc2626", label: "Gap (<30)" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority gap cards */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Priority gaps · salary impact
            </h3>
            {skillGaps.length > 0 ? (
              <div className="space-y-3">
                {skillGaps.slice(0, 4).map((gap) => (
                  <GapCard key={gap.skill} gap={gap} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Run a career analysis to see your skill gaps.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Job coverage matrix ── */}
      {jobs.length > 0 && skills.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500" />
              Skill coverage vs. your job matches
              <span className="ml-auto text-xs text-gray-400 font-normal">
                Shows why each match % is what it is
              </span>
            </h3>
            <CoverageTable
              jobs={jobs}
              skills={skills.map((s) => s.name)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
