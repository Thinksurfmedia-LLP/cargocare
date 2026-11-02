// Email to the liner broker whose MD-approved assignment was withdrawn because
// the shipment plan was cancelled before anything was booked.

export interface PlanCancelledEmailDetails {
  referenceNumber: string
  customer: string
  businessBranch: string
  cancelledBy: string
  cancellationRemark: string
  equipmentSummary: string
  portOfLoading: string
  portOfDischarge: string
  linerBookingsUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// "20ft Standard Container (2 units), 40ft High Cube Container (1 unit)"
export function formatEquipmentSummary(equipmentDetails: unknown): string {
  if (!Array.isArray(equipmentDetails)) return "N/A"
  const counts = new Map<string, number>()
  for (const equipment of equipmentDetails) {
    const type = equipment?.equipment_type
    if (typeof type === "string" && type) counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const summary = [...counts].map(([type, count]) => `${type} (${count} unit${count === 1 ? "" : "s"})`).join(", ")
  return summary || "N/A"
}

export function buildPlanCancelledEmail(details: PlanCancelledEmailDetails): {
  subject: string
  html: string
  text: string
} {
  const safe = (value: string) => escapeHtml(value || "N/A")
  const rows: [string, string][] = [
    ["Customer", details.customer],
    ["Branch", details.businessBranch],
    ["Cancelled By", details.cancelledBy],
    ["Equipment", details.equipmentSummary],
    ["POL", details.portOfLoading],
    ["POD", details.portOfDischarge],
  ]

  const subject = `🚫 Shipment Plan ${details.referenceNumber} Cancelled - Assignment Withdrawn`

  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 0;">
          <div style="max-width: 580px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <div style="background: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 600;">🚫 Shipment Plan Cancelled</h1>
            </div>
            <div style="padding: 20px;">
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">Dear Liner Booking Team,</p>
              <div style="background: #fee2e2; border-left: 3px solid #dc2626; padding: 12px 14px; margin: 16px 0;">
                <div style="font-size: 11px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Reference Number</div>
                <div style="font-size: 16px; font-weight: 700; color: #b91c1c; margin-top: 2px;">${safe(details.referenceNumber)}</div>
              </div>
              <p style="font-size: 14px; color: #374151; margin: 16px 0;">
                This shipment plan was approved by the MD and assigned to you, but it has now been
                <strong style="color: #dc2626;">cancelled before booking</strong>. The assignment has been
                withdrawn from your list and you no longer need to book it.
              </p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px; margin: 16px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #991b1b; margin-bottom: 6px;">Reason for Cancellation</div>
                <div style="font-size: 14px; color: #7f1d1d; white-space: pre-wrap;">${safe(details.cancellationRemark)}</div>
              </div>
              <table style="width: 100%; border: 1px solid #e5e7eb; border-radius: 6px; border-collapse: collapse; margin: 16px 0;">
                ${rows
                  .map(
                    ([label, value]) => `
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #6b7280; width: 140px; padding: 10px 14px; border-bottom: 1px solid #f3f4f6;">${label}</td>
                  <td style="font-size: 13px; color: #111827; font-weight: 500; padding: 10px 14px; border-bottom: 1px solid #f3f4f6;">${safe(value)}</td>
                </tr>`,
                  )
                  .join("")}
              </table>
              <div style="text-align: center; margin: 20px 0 16px 0;">
                <a href="${escapeHtml(details.linerBookingsUrl)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">View Liner Bookings</a>
              </div>
            </div>
            <div style="text-align: center; color: #9ca3af; font-size: 12px; padding: 16px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0;">Cargocare Booking Management System · Automated Notification</p>
            </div>
          </div>
        </body>
      </html>
    `

  const text = `
Shipment Plan Cancelled

Shipment Plan ${details.referenceNumber} was approved by the MD and assigned to you, but it has been cancelled before booking.
The assignment has been withdrawn from your list and you no longer need to book it.

Reason for Cancellation: ${details.cancellationRemark || "N/A"}

Shipment Details:
${rows.map(([label, value]) => `- ${label}: ${value || "N/A"}`).join("\n")}

View your liner bookings: ${details.linerBookingsUrl}

This is an automated notification from Cargocare Booking Management System.
    `

  return { subject, html, text }
}
