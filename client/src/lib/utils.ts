
// Think of clsx as:“Smart class combiner”

// twMerge
// import { twMerge } from "tailwind-merge"
// This fixes Tailwind conflicts
// Problem: "p-2 p-4"
// Which one applies? (confusing)
// twMerge solves it:
// twMerge("p-2 p-4")
// Result: "p-4"
// Last one wins (correct behavior)

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// This is just a helper function for class names (CSS styles)

// Normally in React, you write:
// <div className="p-2 bg-red-500 rounded" />
// But sometimes you want:
// combine classes
// add classes conditionally
// avoid duplicates
// That becomes messy:
// <div className={"p-2 " + (isActive ? "bg-red-500" : "bg-blue-500")} />
// Hard to read.

// What is ClassValue?
// From clsx, it means:
// it can be:
// string → "p-2"
// boolean → true / false
// object → { active: true }
// array → ["p-2", "bg-red"]

// ...inputs (spread operator)
//  This means:
// “Take multiple arguments and collect them into one array”

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
