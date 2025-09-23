import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendNewApprovalNotification(
    mdEmails: string[],
    shipmentData: {
      referenceNumber: string;
      customer: string;
      businessBranch: string;
      createdBy: string;
      pendingApprovalsUrl: string;
    }
  ): Promise<boolean> {
    const subject = `New Shipment Approval Required - ${shipmentData.referenceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .details { background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb; }
            .details h3 { margin-top: 0; margin-bottom: 16px; color: #1e40af; font-size: 18px; font-weight: 600; }
            .detail-row { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #374151; min-width: 140px; }
            .detail-value { color: #111827; font-weight: 500; }
            .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.25); transition: all 0.2s ease; }
            .button:hover { background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); transform: translateY(-1px); box-shadow: 0 6px 8px rgba(37, 99, 235, 0.3); }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .intro-text { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
            .action-text { color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚢 New Shipment Approval Required</h1>
            </div>
            <div class="content">
              <p class="intro-text">Dear MD,</p>

              <p class="intro-text">A new shipment plan has been submitted and requires your approval.</p>

              <div class="details">
                <h3>📋 Shipment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Reference Number:</span>
                  <span class="detail-value"><strong>${shipmentData.referenceNumber}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Customer:</span>
                  <span class="detail-value">${shipmentData.customer}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Business Branch:</span>
                  <span class="detail-value">${shipmentData.businessBranch}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Created By:</span>
                  <span class="detail-value">${shipmentData.createdBy}</span>
                </div>
              </div>

              <p class="action-text">Please review and approve or reject this shipment plan at your earliest convenience.</p>

              <div style="text-align: center;">
                <a href="${shipmentData.pendingApprovalsUrl}" class="button" style="color: #ffffff !important;">
                  📝 Review Pending Approvals
                </a>
              </div>

              <div class="footer">
                <p>This is an automated notification from Cargo Care System</p>
                <p style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
                  Please do not reply to this email. For support, contact your system administrator.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
New Shipment Approval Required

A new shipment plan has been submitted and requires your approval.

Shipment Details:
- Reference Number: ${shipmentData.referenceNumber}
- Customer: ${shipmentData.customer}
- Business Branch: ${shipmentData.businessBranch}
- Created By: ${shipmentData.createdBy}

Please visit ${shipmentData.pendingApprovalsUrl} to review and approve or reject this shipment plan.

This is an automated notification from Cargo Care System.
    `;

    return await this.sendEmail({
      to: mdEmails,
      subject,
      html,
      text,
    });
  }

  async sendDailyReminderNotification(
    mdEmails: string[],
    pendingCount: number,
    shipments: Array<{
      referenceNumber: string;
      customer: string;
      businessBranch: string;
      createdAt: string;
    }>,
    pendingApprovalsUrl: string
  ): Promise<boolean> {
    const subject = `Daily Reminder: ${pendingCount} Shipment${pendingCount > 1 ? 's' : ''} Pending Approval`;

    const shipmentsList = shipments.map(shipment => `
      <div style="border-left: 4px solid #fbbf24; padding: 10px; margin: 10px 0; background-color: #fffbeb;">
        <strong>${shipment.referenceNumber}</strong><br>
        Customer: ${shipment.customer}<br>
        Branch: ${shipment.businessBranch}<br>
        Submitted: ${new Date(shipment.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #fef3c7; padding: 30px; border-radius: 0 0 8px 8px; }
            .summary { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .count { font-size: 48px; font-weight: bold; color: #f59e0b; margin: 10px 0; }
            .button { display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Daily Approval Reminder</h1>
            </div>
            <div class="content">
              <p>Dear MD,</p>

              <div class="summary">
                <div class="count">${pendingCount}</div>
                <p><strong>Shipment${pendingCount > 1 ? 's' : ''} Awaiting Your Approval</strong></p>
              </div>

              <p>The following shipment plans are pending your approval:</p>

              ${shipmentsList}

              <p>Please take a moment to review these pending approvals to keep operations running smoothly.</p>

              <a href="${pendingApprovalsUrl}" class="button">
                Review All Pending Approvals
              </a>

              <div class="footer">
                <p>This is an automated daily reminder from Cargo Care System</p>
                <p>You receive this reminder every day at 12:00 PM IST when there are pending approvals</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Daily Approval Reminder

${pendingCount} shipment${pendingCount > 1 ? 's' : ''} awaiting your approval:

${shipments.map(shipment => `
- ${shipment.referenceNumber} | ${shipment.customer} | ${shipment.businessBranch} | ${new Date(shipment.createdAt).toLocaleDateString()}
`).join('')}

Please visit ${pendingApprovalsUrl} to review all pending approvals.

This is an automated daily reminder from Cargo Care System.
    `;

    return await this.sendEmail({
      to: mdEmails,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();