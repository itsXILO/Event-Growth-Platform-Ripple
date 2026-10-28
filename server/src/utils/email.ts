import { Resend } from "resend";
import {
  generateIcsCalendar,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  CalendarEventDetails,
} from "./calendar";

export interface SendRegistrationEmailParams {
  to: string;
  name: string;
  eventTitle: string;
  eventStartsAt: Date;
  eventSlug: string;
  referralCode: string;
  shareLink: string;
  collegeName?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  mock?: boolean;
  error?: string;
}

/**
 * Sends a confirmation email to the newly registered student.
 * Completely non-blocking and failure-safe.
 * If RESEND_API_KEY is missing, gracefully logs the email to console.
 */
export async function sendRegistrationConfirmationEmail(
  params: SendRegistrationEmailParams
): Promise<EmailSendResult> {
  const {
    to,
    name,
    eventTitle,
    eventStartsAt,
    referralCode,
    shareLink,
    collegeName,
  } = params;

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(eventStartsAt));

  const calendarDetails: CalendarEventDetails = {
    title: `${eventTitle} - Free NxtWave Workshop`,
    description: `Build your first AI project in 60 minutes and walk away with something you can show recruiters!\n\nYour Referral Squad Link: ${shareLink}\nReferral Code: ${referralCode}\nCollege: ${collegeName || "Engineering"}\n\nNo local CUDA drivers or Python virtualenvs required - build directly in your browser.`,
    location: "Live Interactive Cloud IDE (Online Workshop)",
    startsAt: new Date(eventStartsAt),
    durationMinutes: 60,
    url: shareLink,
  };

  const icsContent = generateIcsCalendar(calendarDetails);
  const googleCalendarUrl = getGoogleCalendarUrl(calendarDetails);
  const outlookCalendarUrl = getOutlookCalendarUrl(calendarDetails);

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM || "NxtWave AI Workshop <onboarding@resend.dev>";

  // ── Fallback: No API Key provided -> Log to console gracefully ───────────────
  if (!resendApiKey || resendApiKey.startsWith("placeholder") || resendApiKey === "your_api_key_here") {
    console.log("\n=======================================================");
    console.log("📨 [EMAIL DISPATCH - MOCK MODE: No RESEND_API_KEY set]");
    console.log(`To:            ${name} <${to}>`);
    console.log(`Subject:       🎉 Seat Confirmed: ${eventTitle}`);
    console.log(`When:          ${formattedDate} (IST)`);
    console.log(`Referral Code: ${referralCode}`);
    console.log(`Share Link:    ${shareLink}`);
    console.log(`Calendar:      .ics generated (${icsContent.length} bytes)`);
    console.log(`Google Cal:    ${googleCalendarUrl.slice(0, 80)}...`);
    console.log("=======================================================\n");

    return {
      success: true,
      mock: true,
      messageId: `mock-${Date.now()}`,
    };
  }

  // ── Send real email via Resend API ───────────────────────────────────────────
  try {
    const resend = new Resend(resendApiKey);

    const whatsappMessage = encodeURIComponent(
      `Hey! I just registered for the free NxtWave workshop "Build Your First AI Project in 60 Minutes". Use my link to join and help our college climb the live leaderboard! 🚀 ${shareLink}`
    );

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; }
    .header p { margin: 8px 0 0; color: #e0e7ff; font-size: 14px; }
    .content { padding: 32px 24px; }
    .highlight-box { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .ref-code { font-size: 24px; font-family: monospace; font-weight: bold; color: #818cf8; letter-spacing: 2px; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 8px 4px 8px 0; }
    .btn-wa { background: #25D366; color: #000000 !important; }
    .btn-cal { background: #374151; color: #f3f4f6 !important; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🎟️ Your Seat is Confirmed!</h1>
      <p>${eventTitle}</p>
    </div>
    <div class="content">
      <p>Hi <strong>${name}</strong>,</p>
      <p>You're all set! We have reserved your complimentary seat for the <strong>Build Your First AI Project in 60 Minutes</strong> hands-on workshop.</p>

      <div class="highlight-box">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #9ca3af; font-weight: 700;">Workshop Schedule</p>
        <p style="margin: 0; font-size: 16px; font-weight: bold; color: #ffffff;">📅 ${formattedDate}</p>
        <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">📍 Format: Interactive Browser Cloud IDE (Zero Local Setup)</p>
        ${collegeName ? `<p style="margin: 6px 0 0; font-size: 13px; color: #818cf8;">🏛️ Representing: ${collegeName}</p>` : ""}
      </div>

      <div style="margin: 24px 0;">
        <p style="font-weight: bold; margin-bottom: 8px; color: #ffffff;">Add to your calendar:</p>
        <a href="${googleCalendarUrl}" class="btn btn-cal" target="_blank">📅 Google Calendar</a>
        <a href="${outlookCalendarUrl}" class="btn btn-cal" target="_blank">📆 Outlook</a>
      </div>

      <div class="highlight-box">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #a78bfa; font-weight: 700;">Your Campus Squad Referral Code</p>
        <div class="ref-code">${referralCode}</div>
        <p style="margin: 10px 0 4px; font-size: 13px; color: #d1d5db;">Invite batchmates to boost your college on the regional leaderboard:</p>
        <p style="margin: 0; font-family: monospace; font-size: 12px; color: #9ca3af; word-break: break-all;">${shareLink}</p>
        <div style="margin-top: 14px;">
          <a href="https://wa.me/?text=${whatsappMessage}" class="btn btn-wa" target="_blank">💬 Share on WhatsApp</a>
        </div>
      </div>

      <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
        <strong>What you'll walk away with:</strong> A live, deployed AI Career Copilot to showcase on LinkedIn, GitHub, and resumes for technical screenings.
      </p>
    </div>
    <div class="footer">
      <p>NxtWave AI Workshop · Regional Engineering Cohort</p>
      <p>An .ics calendar invite is attached to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const response = await resend.emails.send({
      from: emailFrom,
      to,
      subject: `🎉 Seat Confirmed: ${eventTitle} (Calendar Invite Attached)`,
      html: emailHtml,
      attachments: [
        {
          filename: "nxtwave-ai-workshop.ics",
          content: Buffer.from(icsContent).toString("base64"),
        },
      ],
    });

    if (response.error) {
      console.error("[email] Resend API error:", response.error);
      return { success: false, error: response.error.message };
    }

    console.log(`[email] Confirmation email successfully delivered via Resend to ${to} (id: ${response.data?.id})`);
    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] Unexpected exception during email dispatch:", errorMsg);
    // Return gracefully so registration is never aborted
    return { success: false, error: errorMsg };
  }
}
