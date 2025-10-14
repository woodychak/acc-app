"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: {
  className?: string
  date?: DateRange
  setDate?: (date: DateRange | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [startDate, setStartDate] = React.useState<Date | null>(date?.from || null)
  const [endDate, setEndDate] = React.useState<Date | null>(date?.to || null)

  const handleStartDateChange = (value: Date) => {
    setStartDate(value)
    const newDate = {
      from: value,
      to: endDate || undefined
    }
    setDate?.(newDate)
    
    // Auto-close if both dates are selected
    if (value && endDate) {
      setTimeout(() => setOpen(false), 300)
    }
  }

  const handleEndDateChange = (value: Date) => {
    setEndDate(value)
    const newDate = {
      from: startDate || undefined,
      to: value
    }
    setDate?.(newDate)
    
    // Auto-close if both dates are selected
    if (startDate && value) {
      setTimeout(() => setOpen(false), 300)
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex gap-4 p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-center">Start Date</div>
              <Calendar
                onChange={(value) => handleStartDateChange(value as Date)}
                value={startDate}
                maxDate={endDate || undefined}
                className="rounded-md border"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-center">End Date</div>
              <Calendar
                onChange={(value) => handleEndDateChange(value as Date)}
                value={endDate}
                minDate={startDate || undefined}
                className="rounded-md border"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}