import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#22c55e", "#ef4444"];

interface AttendanceCardProps {
  checkedIn: number;
  total: number;
  loading: boolean;
  onRefresh: () => void;
}

export function AttendanceCard({ checkedIn, total, loading, onRefresh }: AttendanceCardProps) {
  const pieData = [
    { name: "Checked In", value: checkedIn },
    { name: "Remaining", value: total - checkedIn }
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <CardTitle className="text-sm font-medium">Attendance</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="text-center pt-0">
        {loading ? (
          <div className="flex justify-center items-center h-[140px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : total > 0 ? (
          <>
            <p className="text-2xl font-bold">{checkedIn} / {total} checked in</p>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={25} outerRadius={40} paddingAngle={5}>
                  {pieData.map((e, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                  itemStyle={{ padding: 0 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-muted-foreground pt-10">
            No attendance data
          </p>
        )}
      </CardContent>
    </Card>
  );
}
