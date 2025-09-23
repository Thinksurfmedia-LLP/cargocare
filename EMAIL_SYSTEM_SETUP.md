# Email Notification System Setup

This document explains how to configure and use the email notification system for MD approval workflows in the Cargo Care application.

## Overview

The email notification system sends automatic emails to MDs (Managing Directors) for:
1. **Immediate notifications** when new shipment plans require approval
2. **Daily reminder emails** at 12:00 PM IST for pending approvals

## Features

### 1. New Approval Notifications
- Triggered when a new shipment plan is created with "Awaiting MD Approval" status
- Sent to all active users with MD role
- Contains shipment details (reference number, customer, business branch, created by)
- Includes direct link to pending approvals page

### 2. Daily Reminder Emails
- Scheduled to run every day at 12:00 PM IST (6:30 AM UTC)
- Only sent if there are pending approvals
- Shows count of pending approvals and summary of each shipment
- Includes direct link to pending approvals page

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Base URL for email links
BASE_URL="http://localhost:3000"

# SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="your-email@gmail.com"
```

### SMTP Provider Setup

#### Gmail Configuration
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use the generated app password in `SMTP_PASS`

#### Other Email Providers
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port `587`
- **Yahoo**: `smtp.mail.yahoo.com`, port `587`
- **Custom SMTP**: Contact your email provider for SMTP settings

### Production Configuration

For production deployment, update the following:

```env
BASE_URL="https://your-production-domain.com"
SMTP_HOST="your-production-smtp-host"
SMTP_USER="noreply@your-domain.com"
SMTP_FROM="Cargo Care System <noreply@your-domain.com>"
```

## File Structure

The email system consists of:

```
app/
├── lib/
│   ├── email.server.ts      # Email service and templates
│   └── scheduler.server.ts  # Cron job scheduler
├── entry.server.tsx         # Server initialization
└── routes/
    └── api.shipment-plans.tsx # New approval notifications
```

## Email Templates

### New Approval Notification
- **Subject**: "New Shipment Approval Required - [Reference Number]"
- **Content**: Professional HTML email with shipment details and action button
- **Recipients**: All active MD users

### Daily Reminder
- **Subject**: "Daily Reminder: X Shipment(s) Pending Approval"
- **Content**: Summary of all pending approvals with details
- **Recipients**: All active MD users
- **Schedule**: Daily at 12:00 PM IST

## Testing

### Test New Approval Notification
1. Create a new shipment plan
2. Email should be sent automatically to all MD users
3. Check server logs for confirmation

### Test Daily Reminder
1. Ensure there are pending approvals in the system
2. Use the manual trigger (for testing):
   ```typescript
   import { schedulerService } from '~/lib/scheduler.server';
   await schedulerService.triggerReminderNow();
   ```

### Troubleshooting

#### Common Issues

1. **Emails not sending**
   - Verify SMTP credentials in `.env`
   - Check if 2FA is enabled (for Gmail)
   - Verify network connectivity

2. **Gmail authentication failed**
   - Use App Password instead of regular password
   - Ensure 2FA is enabled on Gmail account

3. **Daily reminders not working**
   - Check server logs for cron job execution
   - Verify timezone settings (should be UTC)
   - Ensure server process is running continuously

4. **MD users not receiving emails**
   - Verify users have role "MD" in database
   - Check if users are marked as `isActive: true`
   - Verify email addresses are correct

#### Logging

The system logs important events:
- Email sending success/failure
- Cron job execution
- MD user discovery
- Pending approval counts

Check server console for these logs.

## Database Requirements

Ensure the following:
1. Users table has `role` relationship configured
2. Role table contains "MD" role type
3. Users have valid email addresses
4. ShipmentPlan data contains required fields:
   - `booking_status`
   - `reference_number`
   - `container_movement.customer`
   - `bussiness_branch`

## Security Considerations

1. **SMTP Credentials**: Never commit SMTP passwords to version control
2. **Environment Variables**: Use secure environment variable management in production
3. **Email Content**: Emails contain business-sensitive information - ensure SMTP connection is secure
4. **Rate Limiting**: Consider implementing rate limiting for email notifications

## Production Deployment

1. Configure production SMTP server
2. Set up proper DNS records (SPF, DKIM) for email authentication
3. Monitor email delivery rates
4. Set up email bounce/complaint handling
5. Consider using dedicated email service (SendGrid, AWS SES, etc.)

## API Reference

### Email Service Methods

```typescript
// Send new approval notification
await emailService.sendNewApprovalNotification(mdEmails, shipmentData);

// Send daily reminder
await emailService.sendDailyReminderNotification(mdEmails, count, shipments, url);
```

### Scheduler Service Methods

```typescript
// Initialize scheduler (called automatically on server start)
schedulerService.init();

// Manual trigger (for testing)
await schedulerService.triggerReminderNow();

// Stop scheduler
schedulerService.stop();
```