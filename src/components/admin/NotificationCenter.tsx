import React, { useState } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Settings,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { NotificationService } from '../../services/notificationService';
import { NotificationItem } from '../../types';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(dataService.getNotifications());
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'SMS' | 'Email' | 'WhatsApp'>('All');
  const [testRecipient, setTestRecipient] = useState('');
  const [testChannel, setTestChannel] = useState<'SMS' | 'Email'>('SMS');
  const [testSentNotice, setTestSentNotice] = useState<string | null>(null);

  const refreshLogs = () => {
    setNotifications(dataService.getNotifications());
  };

  const handleRunManualScan = async () => {
    const res = await NotificationService.runAutomatedChecks();
    refreshLogs();
    setTestSentNotice(`Automated check executed: ${res.remindersSent} communications queued, ${res.overdueCount} clients updated.`);
    setTimeout(() => setTestSentNotice(null), 5000);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) return;

    let smsStatus = 'Sent';
    if (testChannel === 'SMS') {
      const termiiRes = await NotificationService.termiiProvider.sendSms({
        to: testRecipient.trim(),
        sms: `GamblePause Test: Your scheduled check-in is ready. Complete confidentially: https://gamblepause.org/?view=client-assessment. Toll-free: 0800-PAUSE`,
        from: 'GamblePause',
      });
      smsStatus = termiiRes.status === 'failed' ? 'Failed' : 'Sent';
    }

    const dummyNotification: NotificationItem = {
      id: `notif-test-${Date.now()}`,
      clientId: 'GP-TEST',
      clientName: 'Test Recipient',
      channel: testChannel,
      triggerType: 'Assessment Due',
      recipientTarget: testRecipient.trim(),
      recipient: testRecipient.trim(),
      subject: 'GamblePause: Your Scheduled Check-in is Ready',
      messageBody: `Hello! Your next GamblePause check-in is ready. Please take 2 minutes to complete your assessment confidentially here: https://gamblepause.org/?view=client-assessment&clientKey=sample-test-key. We are rooting for you!`,
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      status: smsStatus as any,
    };

    dataService.queueNotification(dummyNotification);
    refreshLogs();
    setTestSentNotice(`Test ${testChannel} successfully triggered to ${testRecipient.trim()}!`);
    setTimeout(() => setTestSentNotice(null), 4000);
    setTestRecipient('');
  };

  const filteredLogs = notifications.filter((n) => {
    if (selectedChannel !== 'All' && n.channel !== selectedChannel) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Communications & Reminder Engine
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Automated delivery dispatch for Nigerian SMS (Termii), Email (SendGrid), and WhatsApp.
          </p>
        </div>

        <button
          onClick={handleRunManualScan}
          id="manual-notif-scan-btn"
          className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Execute Automated Schedule Now</span>
        </button>
      </div>

      {testSentNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testSentNotice}</span>
        </div>
      )}

      {/* Gateway Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Termii SMS */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-gray-900">Termii SMS Gateway (Nigeria)</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Delivers low-latency SMS to MTN, Airtel, Glo, and 9mobile phone numbers with Sender ID "GamblePause".
          </p>
          <div className="text-[10px] text-gray-400 pt-1">
            Sender ID: <span className="font-mono text-gray-700">GAMBLEPAUSE</span>
          </div>
        </div>

        {/* Email Gateway */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-900">SendGrid / Secure SMTP</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Sends personalized emails containing 1-click tokenized assessment links and encouragement.
          </p>
          <div className="text-[10px] text-gray-400 pt-1">
            From: <span className="font-mono text-gray-700">support@gamblepause.org</span>
          </div>
        </div>

        {/* WhatsApp Gateway */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-gray-900">WhatsApp Business API</span>
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Optional / Ready
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Automated WhatsApp notification templates for clients who prefer WhatsApp touchpoints.
          </p>
          <div className="text-[10px] text-gray-400 pt-1">
            High response rate channel in Nigeria
          </div>
        </div>
      </div>

      {/* Test Dispatch & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Dispatch Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-red-600" />
            <span>Simulate / Send Test Dispatch</span>
          </h2>
          <p className="text-xs text-gray-500">
            Send a sample assessment notification to verify gateway routing and delivery.
          </p>

          <form onSubmit={handleSendTest} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Channel</label>
              <div className="grid grid-cols-2 gap-2">
                {(['SMS', 'Email'] as const).map((ch) => (
                  <button
                    type="button"
                    key={ch}
                    onClick={() => setTestChannel(ch)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      testChannel === ch
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {testChannel === 'SMS' ? 'Nigerian Phone Number (+234...)' : 'Recipient Email Address'}
              </label>
              <input
                type={testChannel === 'SMS' ? 'tel' : 'email'}
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder={testChannel === 'SMS' ? '08031234567' : 'counsellor@gamblepause.org'}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs transition-all cursor-pointer"
            >
              Trigger Test Notification
            </button>
          </form>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 leading-relaxed">
            All outgoing messages comply with GamblePause anti-stigma privacy guidelines. No medical diagnostic labels are used in SMS sender previews.
          </div>
        </div>

        {/* Live Notification Activity Logs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2 flex flex-col justify-between">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Live Delivery Dispatch Feed</h2>
              <p className="text-xs text-gray-500">History of automated and counsellor-triggered dispatches</p>
            </div>

            <div className="flex items-center gap-1 text-xs">
              {(['All', 'SMS', 'Email'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedChannel === ch
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                No notification activity found for this channel.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/60 transition-colors space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-950">{log.clientName}</span>
                      <span className="text-[10px] font-mono text-gray-500">({log.clientId})</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {log.channel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span>
                        {new Date(log.scheduledFor).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        {log.status}
                      </span>
                    </div>
                  </div>

                  <p className="font-semibold text-gray-800">{log.subject || log.triggerType}</p>
                  <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 font-mono">
                    {log.messageBody}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Automated cron interval: Every 6 hours</span>
            <span>Total Dispatches: {notifications.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
