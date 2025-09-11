"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

const Accordion = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
));
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // Removed 'overflow-hidden' from AccordionItem to allow dropdowns to escape
    className={cn("border border-gray-200 rounded-xl shadow-lg", className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isOpen?: boolean;
  }
>(({ className, children, isOpen = false, ...props }, ref) => (
  <button
    type="button"
    className={cn(
      "flex flex-1 items-center justify-between py-4 px-6 font-medium transition-all hover:bg-gray-50 [&[data-state=open]>svg]:rotate-180",
      className
    )}
    ref={ref}
    {...props}
  >
    <div className="flex items-center space-x-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
          isOpen ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
        }`}
      >
        <span className="text-sm">
          {/* You can customize icons here based on section */}
          {children &&
          typeof children === "string" &&
          children.includes("Customer")
            ? "👤"
            : children &&
              typeof children === "string" &&
              children.includes("Package")
            ? "📦"
            : children &&
              typeof children === "string" &&
              children.includes("Equipment")
            ? "⚙️"
            : children &&
              typeof children === "string" &&
              children.includes("Movement")
            ? "🚚"
            : children &&
              typeof children === "string" &&
              children.includes("Carrier")
            ? "🚢"
            : children &&
              typeof children === "string" &&
              children.includes("Stuffing")
            ? "📝"
            : children &&
              typeof children === "string" &&
              children.includes("Tracking")
            ? "📍"
            : children &&
              typeof children === "string" &&
              children.includes("MD Approval")
            ? "✅"
            : "ℹ️"}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900">{children}</h3>
        {/* Optional: Add a subtitle based on children or props */}
        {children &&
          typeof children === "string" &&
          children.includes("Customer") && (
            <p className="text-sm text-gray-500">
              Financial and contact details
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Package") && (
            <p className="text-sm text-gray-500">
              Commodity, weight, and volume
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Equipment") && (
            <p className="text-sm text-gray-500">
              Container types and quantities
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Movement") && (
            <p className="text-sm text-gray-500">
              Ports, countries, and delivery
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Carrier") && (
            <p className="text-sm text-gray-500">
              Preferred shipping lines and vessels
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Stuffing") && (
            <p className="text-sm text-gray-500">
              Special handling instructions
            </p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("Tracking") && (
            <p className="text-sm text-gray-500">Real-time container status</p>
          )}
        {children &&
          typeof children === "string" &&
          children.includes("MD Approval") && (
            <p className="text-sm text-gray-500">
              Managing Director's decision
            </p>
          )}
      </div>
    </div>
    <svg
      className={cn("h-4 w-4 shrink-0 transition-transform duration-200", {
        "rotate-180": isOpen,
      })}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline points="6,9 12,15 18,9"></polyline>
    </svg>
  </button>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    isOpen?: boolean;
  }
>(({ className, children, isOpen = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "transition-all duration-300",
      // Ensure overflow-visible when open, and hidden when closed for animation
      isOpen
        ? "animate-in slide-in-from-top-1 overflow-visible"
        : "animate-out slide-out-to-top-1 hidden overflow-hidden",
      className
    )}
    {...props}
  >
    <div className={cn("px-6 pb-6 pt-0 bg-gray-50/50", className)}>
      {children}
    </div>
  </div>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
