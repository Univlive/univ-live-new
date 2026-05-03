import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  showPeriodSelect?: boolean;
  delay?: number;
  periodValue?: string;
  onPeriodChange?: (value: string) => void;
}

export default function ChartCard({
  title,
  children,
  showPeriodSelect = false,
  delay = 0,
  periodValue,
  onPeriodChange,
}: ChartCardProps) {
  const [localPeriod, setLocalPeriod] = useState("30");
  const selectedPeriod = periodValue ?? localPeriod;

  function handlePeriodChange(value: string) {
    if (onPeriodChange) {
      onPeriodChange(value);
      return;
    }
    setLocalPeriod(value);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {showPeriodSelect && (
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 3 months</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}
