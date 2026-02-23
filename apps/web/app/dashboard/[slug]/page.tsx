"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { apiRequest } from "@/lib/api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type Stats = {
  total: number;
  claimed: number;
  remaining: number;
  progress: number;
  claimHistory: { date: string; value: number }[];
};

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Stats>(`/migrations/${slug}/stats`)
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error) {
    return <p className="py-8 text-sm text-danger">{error}</p>;
  }

  if (!stats) {
    return <p className="py-8 text-sm text-foreground/75">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Total Holders</CardTitle>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
        </Card>
        <Card>
          <CardTitle>Claimed</CardTitle>
          <p className="mt-2 text-3xl font-semibold text-neon">{stats.claimed}</p>
        </Card>
        <Card>
          <CardTitle>Remaining</CardTitle>
          <p className="mt-2 text-3xl font-semibold text-accent">{stats.remaining}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <CardTitle>Migration Progress</CardTitle>
        <CardDescription>{stats.progress}% complete</CardDescription>
        <Progress value={stats.progress} />
      </Card>

      <Card className="h-80">
        <CardTitle>Claim History</CardTitle>
        <div className="mt-4 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.claimHistory}>
              <defs>
                <linearGradient id="claimGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2EF2B8" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#2EF2B8" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2B45" />
              <XAxis dataKey="date" stroke="#94A3B8" />
              <YAxis stroke="#94A3B8" allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#2EF2B8" fill="url(#claimGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardTitle>Claim Breakdown</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Claims</TH>
              </TR>
            </THead>
            <TBody>
              {stats.claimHistory.length === 0 && (
                <TR>
                  <TD colSpan={2} className="text-foreground/65">
                    No claims yet.
                  </TD>
                </TR>
              )}
              {stats.claimHistory.map((row) => (
                <TR key={row.date}>
                  <TD>{row.date}</TD>
                  <TD>{row.value}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
