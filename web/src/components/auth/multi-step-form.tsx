'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiStepFormProps {
  steps: string[]
  currentStep: number
}

export function MultiStepForm({ steps, currentStep }: MultiStepFormProps) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, index) => {
        const stepNum = index + 1
        const isCompleted = stepNum < currentStep
        const isActive = stepNum === currentStep

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            {/* Step bubble */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-all duration-300',
                  isCompleted &&
                    'bg-gradient-to-br from-purple-400 to-pink-400 border-transparent text-white',
                  isActive &&
                    'border-2 border-transparent bg-gradient-to-br from-purple-500 via-pink-400 to-orange-300 text-white shadow-lg shadow-purple-500/30',
                  !isCompleted &&
                    !isActive &&
                    'bg-white/5 border-white/20 text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isActive ? 'text-white' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line — not after last step */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-2 mb-5 transition-all duration-300',
                  isCompleted ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-white/10'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
