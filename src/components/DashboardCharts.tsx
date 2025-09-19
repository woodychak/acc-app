"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, FileText } from "lucide-react";

interface ChartData {
  name: string;
  value: number;
  formattedValue: string;
  [key: string]: string | number;
}

interface PieLabelProps {
  name: string;
  value: number;
  percent: number;
  x: number;
  y: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  index: number;
}

interface DashboardChartsProps {
  revenueChartData: ChartData[];
  outstandingChartData: ChartData[];
  hasRevenueData: boolean;
  hasOutstandingData: boolean;
}

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export default function DashboardCharts({
  revenueChartData,
  outstandingChartData,
  hasRevenueData,
  hasOutstandingData,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Pie Chart */}
      {hasRevenueData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Revenue by Currency</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: PieLabelProps) => {
                      const { name, percent } = props;
                      return `${name} ${(percent! * 100).toFixed(1)}%`; // `percent!` ensures TS knows it's not undefined
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      revenueChartData.find((item) => item.name === name)
                        ?.formattedValue || value,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Pie Chart */}
      {hasOutstandingData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Outstanding by Currency</CardTitle>
            <FileText className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outstandingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(1)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {outstandingChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      outstandingChartData.find((item) => item.name === name)
                        ?.formattedValue || value,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
