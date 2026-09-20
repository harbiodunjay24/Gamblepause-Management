import { Client, ClientStatus, FormDefinition, NotificationLog } from '../types';
import { dataService } from './dataService';

/**
 * Configuration options for Termii SMS Gateway (Nigeria)
 */
export interface TermiiConfig {
  apiKey?: string;
  senderId?: string; // Approved Nigerian alphanumeric Sender ID (e.g. 'GamblePause')
  baseUrl?: string; // Default: 'https://api.ng.termii.com/api/sms/send'
  channel?: 'generic' | 'dnd' | 'whatsapp';
}

/**
 * Request payload structure for the Termii API endpoint: POST /api/sms/send
 */
export interface TermiiSendPayload {
  to: string; // Recipient phone number in international format (e.g. 2348031234567)
  from: string; // Registered sender ID
  sms: string; // SMS content (160 characters per page)
  type: 'plain' | 'unicode';
  channel: 'generic' | 'dnd' | 'whatsapp';
  api_key: string;
}

/**
 * Standard response structure returned from the Termii API
 */
export interface TermiiResponse {
  message_id?: string;
  message?: string;
  balance?: number;
  user?: string;
  code?: string;
  status: 'success' | 'simulated' | 'failed' | 'queued';
  statusCode?: number;
  timestamp: string;
}

/**
 * Placeholder interface for sending SMS notifications via the Termii API
 */
export interface ITermiiSmsProvider {
  sendSms(options: {
    to: string;
    sms: string;
    from?: string;
    channel?: 'generic' | 'dnd' | 'whatsapp';
    type?: 'plain' | 'unicode';
  }): Promise<TermiiResponse>;
  formatNigerianPhoneNumber(phone: string): string;
  isConfigured(): boolean;
}

/**
 * Termii SMS Client Implementation
 * Provides robust phone formatting for Nigerian telcos (MTN, Airtel, Glo, 9mobile)
 * and seamless fallback simulation when in evaluation / sandbox mode.
 */
export class TermiiSmsClient implements ITermiiSmsProvider {
  private config: TermiiConfig;

  constructor(config?: Partial<TermiiConfig>) {
    const envApiKey =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_TERMII_API_KEY || ''
        : '';
    const envSenderId =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_TERMII_SENDER_ID || 'GamblePause'
        : 'GamblePause';

    this.config = {
      apiKey: config?.apiKey || envApiKey,
      senderId: config?.senderId || envSenderId,
      baseUrl: config?.baseUrl || 'https://api.ng.termii.com/api/sms/send',
      channel: config?.channel || 'generic',
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  /**
   * Sanitizes and formats Nigerian telephone numbers to E.164 without '+'
   * e.g., '0803 123 4567' -> '2348031234567'
   * e.g., '+234 803 123 4567' -> '2348031234567'
   */
  public formatNigerianPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Dispatches SMS message via Termii API or returns simulated response
   */
  public async sendSms(options: {
    to: string;
    sms: string;
    from?: string;
    channel?: 'generic' | 'dnd' | 'whatsapp';
    type?: 'plain' | 'unicode';
  }): Promise<TermiiResponse> {
    const formattedPhone = this.formatNigerianPhoneNumber(options.to);
    const senderId = options.from || this.config.senderId || 'GamblePause';
    const channel = options.channel || this.config.channel || 'generic';

    // If API key is not present, return simulated Termii delivery confirmation
    if (!this.isConfigured()) {
      return {
        message_id: `termii-sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        message: `Simulated SMS dispatched via Termii Gateway to ${formattedPhone || options.to}`,
        status: 'simulated',
        statusCode: 200,
        timestamp: new Date().toISOString(),
      };
    }

    // Direct fetch call to Termii API endpoint
    try {
      const payload: TermiiSendPayload = {
        to: formattedPhone,
        from: senderId,
        sms: options.sms,
        type: options.type || 'plain',
        channel,
        api_key: this.config.apiKey!,
      };

      const response = await fetch(this.config.baseUrl || 'https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          message_id: data.message_id,
          message: data.message || `Termii API error: ${response.status} ${response.statusText}`,
          status: 'failed',
          statusCode: response.status,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        message_id: data.message_id || `termii-${Date.now()}`,
        message: data.message || 'SMS successfully dispatched via Termii',
        balance: data.balance,
        user: data.user,
        status: 'success',
        statusCode: 200,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        message: err?.message || 'Network exception communicating with Termii API',
        status: 'failed',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export interface NotificationPayload {
  toEmail?: string;
  toPhone?: string;
  clientName: string;
  assessmentName: string;
  assessmentLink: string;
  daysRemaining?: number;
  type: 'ready' | 'reminder_24h' | 'reminder_3d' | 'overdue' | 'welcome';
}

export class NotificationService {
  /**
   * Singleton Termii SMS Client provider instance
   */
  public static termiiProvider: ITermiiSmsProvider = new TermiiSmsClient();

  /**
   * Configures a custom Termii provider or updates credentials
   */
  public static setTermiiProvider(provider: ITermiiSmsProvider) {
    this.termiiProvider = provider;
  }

  /**
   * Automated handler triggered whenever a client assessment status changes.
   * Structured to automatically fire when an assessment reaches 'Overdue'.
   */
  public static async handleStatusChange(
    client: Client,
    previousStatus: ClientStatus,
    newStatus: ClientStatus
  ): Promise<TermiiResponse | null> {
    if (newStatus === 'Overdue' && previousStatus !== 'Overdue') {
      return await this.triggerOverdueSmsAlert(client);
    }
    return null;
  }

  /**
   * Triggers an urgent, supportive SMS notification via Termii when an assessment is Overdue.
   * Constructs the secure client assessment link and non-judgmental messaging.
   */
  public static async triggerOverdueSmsAlert(
    client: Client,
    customNote?: string
  ): Promise<TermiiResponse> {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gamblepause.org';
    const assessmentLink = `${baseUrl}/?view=client-assessment&clientKey=${client.secureAccessKey}`;
    const firstName = client.preferredName || client.firstName || 'Friend';
    const assessmentName = client.nextAssessmentName || 'Harm-Reduction Check-in';

    // Crafted specifically for high engagement, confidentiality, and empathy in Nigeria
    const smsMessage =
      `GamblePause: Hello ${firstName}, your ${assessmentName} is now past due. ` +
      `Your counsellor is here to support you without judgment. ` +
      `Please tap to complete: ${assessmentLink} or call 0800-GAMBLE-PAUSE (Toll-Free).`;

    // Dispatch SMS through Termii provider
    const termiiResult = await this.termiiProvider.sendSms({
      to: client.phone,
      sms: smsMessage,
      from: 'GamblePause',
      channel: 'generic',
    });

    const isSuccess = termiiResult.status === 'success' || termiiResult.status === 'simulated';

    // Record entry in Notification Log
    dataService.queueNotification({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      channel: 'SMS',
      recipient: client.phone,
      recipientTarget: client.phone,
      subject: `Overdue Alert SMS (Termii) - ${assessmentName}`,
      messageBody: smsMessage,
      triggerType: 'Overdue Alert',
      status: isSuccess ? 'Sent' : 'Failed',
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });

    // Log to audit trail
    dataService.logAudit(
      'TERMII_SMS_OVERDUE_TRIGGER',
      'Client',
      client.id,
      `Automatic Termii SMS triggered for overdue assessment (${assessmentName}) to ${client.phone}. Status: ${termiiResult.status} [${termiiResult.message}]`
    );

    return termiiResult;
  }

  /**
   * Generates email subject and body for client assessment milestones
   */
  public static getEmailContent(payload: NotificationPayload) {
    const { clientName, assessmentName, assessmentLink, type } = payload;
    const firstName = clientName.split(' ')[0] || 'Friend';

    switch (type) {
      case 'welcome':
        return {
          subject: 'Welcome to GamblePause Initiative Africa',
          body: `Hello ${firstName},\n\nThank you for reaching out to GamblePause Initiative Africa.\n\nYour registration has been received with total privacy and care. We are committed to supporting you on your journey toward freedom and financial peace.\n\nYour initial assessment is ready. Please click the link below to take a few quiet minutes to complete it:\n\n${assessmentLink}\n\nWe walk this journey with you, step by step.\n\nWarm regards,\nGamblePause Initiative Africa\nHelpline: +234 800-GAMBLE-PAUSE\nsupport@gamblepause.org`,
        };

      case 'ready':
        return {
          subject: `Your GamblePause ${assessmentName} is Ready`,
          body: `Hello ${firstName},\n\nYour GamblePause follow-up assessment is now ready.\n\nTaking a few minutes to reflect helps track your progress and lets our counsellors tailor the support you receive.\n\nPlease click the secure link below to complete it:\n\n${assessmentLink}\n\nThank you for your commitment to your pause journey.\n\nWarm regards,\nGamblePause Initiative Africa`,
        };

      case 'reminder_24h':
        return {
          subject: `Reminder: Your GamblePause ${assessmentName}`,
          body: `Hello ${firstName},\n\nThis is a gentle reminder that your GamblePause ${assessmentName} is awaiting completion.\n\nWe understand life gets busy, but checking in takes less than 3 minutes:\n\n${assessmentLink}\n\nWe are here for you without judgment.\n\nWarm regards,\nGamblePause Initiative Africa`,
        };

      case 'reminder_3d':
        return {
          subject: `Important Check-in: Your GamblePause ${assessmentName}`,
          body: `Hello ${firstName},\n\nWe noticed you haven't had the chance to complete your ${assessmentName} yet.\n\nIf you are experiencing strong urges, stress, or need someone to talk to, your assigned counsellor is on standby.\n\nYou can complete your check-in here:\n${assessmentLink}\n\nYou are not alone in this.\n\nWarm regards,\nGamblePause Initiative Africa`,
        };

      case 'overdue':
        return {
          subject: `Urgent: GamblePause Check-in Support for ${firstName}`,
          body: `Hello ${firstName},\n\nYour ${assessmentName} is currently past due.\n\nAt GamblePause, we care about your wellbeing. Please take a moment to update your check-in so your counsellor can see how best to support you:\n\n${assessmentLink}\n\nIf you need immediate assistance, call or WhatsApp our confidential line at +234 800-GAMBLE-PAUSE.\n\nWarm regards,\nGamblePause Initiative Africa`,
        };
    }
  }

  /**
   * Generates SMS text optimized for 160 characters (Termii SMS gateway)
   */
  public static getSmsContent(payload: NotificationPayload): string {
    const { clientName, assessmentName, assessmentLink, type } = payload;
    const firstName = clientName.split(' ')[0] || 'Friend';

    switch (type) {
      case 'welcome':
        return `GamblePause: Welcome ${firstName}. Your initial check-in is ready at ${assessmentLink}. We are here for you.`;
      case 'ready':
        return `GamblePause: Hello ${firstName}, your ${assessmentName} is ready. Tap to complete: ${assessmentLink}`;
      case 'reminder_24h':
        return `GamblePause: Gentle reminder for ${firstName}. Complete your check-in: ${assessmentLink}`;
      case 'reminder_3d':
      case 'overdue':
        return `GamblePause: Hi ${firstName}, your counsellor is checking in. Please tap to update us: ${assessmentLink} or call 0800-PAUSE`;
    }
  }

  /**
   * Sends or queues a notification across Email and SMS (via Termii)
   */
  public static async sendAssessmentReminder(
    client: Client,
    form: FormDefinition,
    type: 'ready' | 'reminder_24h' | 'reminder_3d' | 'overdue' = 'ready'
  ) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gamblepause.org';
    const assessmentLink = `${baseUrl}/?view=client-assessment&clientKey=${client.secureAccessKey}`;
    const payload: NotificationPayload = {
      clientName: `${client.firstName} ${client.lastName}`,
      assessmentName: form.name,
      assessmentLink,
      type,
    };

    const emailContent = this.getEmailContent(payload);
    const smsContent = this.getSmsContent(payload);

    // Queue Email
    dataService.queueNotification({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      channel: 'Email',
      recipient: client.email,
      recipientTarget: client.email,
      subject: emailContent.subject,
      messageBody: emailContent.body,
      triggerType:
        type === 'ready'
          ? 'Assessment Ready'
          : type === 'reminder_24h'
          ? 'Reminder 24h'
          : type === 'reminder_3d'
          ? 'Reminder 3d'
          : 'Overdue Alert',
      status: 'Sent',
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });

    // Dispatch SMS via Termii Provider
    const termiiResult = await this.termiiProvider.sendSms({
      to: client.phone,
      sms: smsContent,
      from: 'GamblePause',
    });

    const isSuccess = termiiResult.status === 'success' || termiiResult.status === 'simulated';

    // Queue SMS entry
    dataService.queueNotification({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      channel: 'SMS',
      recipient: client.phone,
      recipientTarget: client.phone,
      subject: `SMS via Termii (${type})`,
      messageBody: smsContent,
      triggerType:
        type === 'ready'
          ? 'Assessment Ready'
          : type === 'reminder_24h'
          ? 'Reminder 24h'
          : type === 'reminder_3d'
          ? 'Reminder 3d'
          : 'Overdue Alert',
      status: isSuccess ? 'Sent' : 'Failed',
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });
  }

  /**
   * Automation Scanner: runs periodic check on all clients
   * Evaluates due dates and flags overdue clients, automatically triggering Termii SMS
   */
  public static async runAutomatedChecks(): Promise<{
    overdueCount: number;
    remindersSent: number;
  }> {
    const clients = dataService.getClients();
    const now = new Date().getTime();
    let overdueCount = 0;
    let remindersSent = 0;

    for (const client of clients) {
      if (client.status === 'Completed' || client.status === 'Closed' || !client.nextAssessmentDueDate) {
        continue;
      }

      const dueTime = new Date(client.nextAssessmentDueDate).getTime();
      const diffMs = now - dueTime;
      const diffHours = diffMs / (1000 * 60 * 60);

      const form = dataService.getFormById(client.nextAssessmentId || '');
      if (!form) continue;

      if (diffHours >= 72 && client.status !== 'Overdue') {
        // More than 3 days late: flag as Overdue & automatically trigger Termii SMS
        dataService.updateClientStatus(
          client.id,
          'Overdue',
          'Automated trigger: Assessment overdue by > 72 hours'
        );
        overdueCount++;
        remindersSent++;
      } else if (diffHours >= 24 && diffHours < 72 && client.status === 'Active') {
        // 24 hours overdue: transition to Assessment Due and send reminder
        dataService.updateClientStatus(client.id, 'Assessment Due');
        await this.sendAssessmentReminder(client, form, 'reminder_24h');
        remindersSent++;
      }
    }

    return { overdueCount, remindersSent };
  }
}

// Automatically bind to dataService status updates so that whenever any client's assessment
// transitions to 'Overdue', the Termii SMS notification triggers automatically.
dataService.onStatusChange((client, previousStatus, newStatus) => {
  NotificationService.handleStatusChange(client, previousStatus, newStatus);
});

