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
        pass: process.env.SMTP_PASS?.replace(/\s/g, ''), // Remove any spaces from app password
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
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
      salesPerson: string;
      equipmentType: string;
      numberOfEquipments: number;
      portOfLoading: string;
      portOfDischarge: string;
      finalPlaceOfDelivery: string;
      pendingApprovalsUrl: string;
    }
  ): Promise<boolean> {
    const subject = `New Shipment Approval Required - ${shipmentData.referenceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.5;
              color: #1f2937;
              background-color: #f3f4f6;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 580px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: #1e40af;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 18px;
              font-weight: 600;
            }
            .content {
              padding: 20px;
            }
            .greeting {
              font-size: 14px;
              color: #374151;
              margin: 0 0 16px 0;
            }
            .ref-box {
              background: #eff6ff;
              border-left: 3px solid #2563eb;
              padding: 12px 14px;
              margin: 16px 0;
            }
            .ref-box .label {
              font-size: 11px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .ref-box .value {
              font-size: 16px;
              font-weight: 700;
              color: #1e40af;
              margin-top: 2px;
            }
            .details {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              overflow: hidden;
              margin: 16px 0;
            }
            .detail-row {
              display: flex;
              padding: 10px 14px;
              border-bottom: 1px solid #f3f4f6;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-row:nth-child(even) {
              background-color: #f9fafb;
            }
            .detail-label {
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              width: 140px;
              flex-shrink: 0;
            }
            .detail-value {
              font-size: 13px;
              color: #111827;
              font-weight: 500;
              flex: 1;
            }
            .btn-container {
              text-align: center;
              margin: 20px 0 16px 0;
            }
            .btn {
              display: inline-block;
              background: #2563eb;
              color: #ffffff !important;
              padding: 12px 28px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 13px;
            }
            .footer {
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
              padding: 16px;
              background-color: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            @media only screen and (max-width: 600px) {
              .detail-row {
                flex-direction: column;
                gap: 2px;
              }
              .detail-label {
                width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Shipment Approval Required</h1>
            </div>
            <div class="content">
              <p class="greeting">Dear Joy Sir,</p>

              <div class="ref-box">
                <div class="label">Reference Number</div>
                <div class="value">${shipmentData.referenceNumber}</div>
              </div>

              <div class="details">
                <div class="detail-row">
                  <span class="detail-label">Customer</span>
                  <span class="detail-value">${shipmentData.customer || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Branch</span>
                  <span class="detail-value">${shipmentData.businessBranch || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Sales Person</span>
                  <span class="detail-value">${shipmentData.salesPerson || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Equipment</span>
                  <span class="detail-value" style="white-space: pre-line;">${(shipmentData.equipmentType || 'N/A').split(', ').join('\n')}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">POL</span>
                  <span class="detail-value">${shipmentData.portOfLoading || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">POD</span>
                  <span class="detail-value">${shipmentData.portOfDischarge || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Final Delivery</span>
                  <span class="detail-value">${shipmentData.finalPlaceOfDelivery || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Created By</span>
                  <span class="detail-value">${shipmentData.createdBy || 'System Administrator'}</span>
                </div>
              </div>

              <div class="btn-container">
                <a href="${shipmentData.pendingApprovalsUrl}" class="btn">Review Pending Approvals</a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">Cargocare Booking Management System · Automated Notification</p>
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
- Equipment Type: ${shipmentData.equipmentType}
- No. of Equipments: ${shipmentData.numberOfEquipments}
- Port of Loading: ${shipmentData.portOfLoading}
- Port of Discharge: ${shipmentData.portOfDischarge}
- Final Place of Delivery: ${shipmentData.finalPlaceOfDelivery}
- Created By: ${shipmentData.createdBy}
- Sales Person: ${shipmentData.salesPerson || 'Not Assigned'}

Please visit ${shipmentData.pendingApprovalsUrl} to review and approve or reject this shipment plan.

This is an automated notification from Cargocare Booking Management System.
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
      equipmentType: string;
      numberOfEquipments: number;
      portOfLoading: string;
      portOfDischarge: string;
      finalPlaceOfDelivery: string;
      createdAt: string;
    }>,
    pendingApprovalsUrl: string
  ): Promise<boolean> {
    const subject = `Daily Reminder: ${pendingCount} Shipment${pendingCount > 1 ? 's' : ''} Pending Approval`;

    const shipmentsList = shipments.map((shipment, index) => `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
        <div style="background: #fef3c7; padding: 12px 16px; border-bottom: 1px solid #fde68a;">
          <div style="font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Shipment ${index + 1}</div>
          <div style="font-size: 16px; font-weight: 700; color: #78350f;">${shipment.referenceNumber}</div>
        </div>
        <div style="padding: 16px;">
          <div style="display: grid; grid-template-columns: 140px 1fr; gap: 10px; font-size: 13px;">
            <div style="color: #6b7280; font-weight: 600;">Customer</div>
            <div style="color: #111827;">${shipment.customer}</div>

            <div style="color: #6b7280; font-weight: 600;">Branch</div>
            <div style="color: #111827;">${shipment.businessBranch}</div>

            <div style="color: #6b7280; font-weight: 600;">Equipment</div>
            <div style="color: #111827; white-space: pre-line;">${shipment.equipmentType.split(', ').join('\n')}</div>

            <div style="color: #6b7280; font-weight: 600;">POL</div>
            <div style="color: #111827;">${shipment.portOfLoading}</div>

            <div style="color: #6b7280; font-weight: 600;">POD</div>
            <div style="color: #111827;">${shipment.portOfDischarge}</div>

            <div style="color: #6b7280; font-weight: 600;">Final Delivery</div>
            <div style="color: #111827;">${shipment.finalPlaceOfDelivery}</div>

            <div style="color: #6b7280; font-weight: 600;">Submitted</div>
            <div style="color: #111827;">${new Date(shipment.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f3f4f6;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: #f59e0b;
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 20px;
              font-weight: 600;
              letter-spacing: -0.5px;
            }
            .content {
              padding: 32px 24px;
              background-color: #fffbeb;
            }
            .summary {
              background: #ffffff;
              border: 2px solid #fbbf24;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
              text-align: center;
            }
            .count {
              font-size: 48px;
              font-weight: 700;
              color: #f59e0b;
              margin: 0;
              line-height: 1;
            }
            .count-label {
              font-size: 14px;
              font-weight: 600;
              color: #92400e;
              margin-top: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .shipments-section {
              margin: 24px 0;
            }
            .section-title {
              font-size: 15px;
              font-weight: 600;
              color: #374151;
              margin-bottom: 16px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0 24px 0;
            }
            .button {
              display: inline-block;
              background: #f59e0b;
              color: #ffffff !important;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
              transition: background 0.2s ease;
            }
            .button:hover {
              background: #d97706;
            }
            .footer {
              text-align: center;
              color: #9ca3af;
              font-size: 13px;
              padding: 24px;
              background-color: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .greeting {
              font-size: 15px;
              color: #374151;
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Daily Approval Reminder</h1>
            </div>
            <div class="content">
              <p class="greeting">Dear Joy Sir,</p>

              <div class="summary">
                <div class="count">${pendingCount}</div>
                <div class="count-label">Shipment${pendingCount > 1 ? 's' : ''} Awaiting Approval</div>
              </div>

              <div class="shipments-section">
                <div class="section-title">Pending Shipments:</div>
                ${shipmentsList}
              </div>

              <div class="button-container">
                <a href="${pendingApprovalsUrl}" class="button">
                  Review All Pending Approvals
                </a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0 0 8px 0;">Cargocare Booking Management System - Daily Reminder</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Daily Approval Reminder

${pendingCount} shipment${pendingCount > 1 ? 's' : ''} awaiting your approval:

${shipments.map(shipment => `
- ${shipment.referenceNumber}
  Customer: ${shipment.customer}
  Branch: ${shipment.businessBranch}
  Equipment: ${shipment.equipmentType} (${shipment.numberOfEquipments} units)
  POL: ${shipment.portOfLoading}
  POD: ${shipment.portOfDischarge}
  Final Delivery: ${shipment.finalPlaceOfDelivery}
  Submitted: ${new Date(shipment.createdAt).toLocaleDateString()}
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