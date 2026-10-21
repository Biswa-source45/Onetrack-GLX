package credmail

import (
	"fmt"
	"html"
	"strings"

	"github.com/onetrack/backend/internal/version"
)

// roleLabel turns SALES_MANAGER into "Sales Manager".
func roleLabel(role string) string {
	words := strings.Fields(strings.ReplaceAll(strings.ToLower(role), "_", " "))
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

func roleList(roles []string) string {
	if len(roles) == 0 {
		return "-"
	}
	out := make([]string, len(roles))
	for i, r := range roles {
		out[i] = roleLabel(r)
	}
	return strings.Join(out, ", ")
}

// Every user-supplied value goes through esc: a name like "<script>" must not become markup in a mail.
func esc(s string) string { return html.EscapeString(s) }

const (
	pStyle    = `margin:0 0 14px 0;font-size:14px;line-height:1.65;color:#1f2937;`
	labelCell = `padding:10px 14px;width:140px;font-size:14px;font-weight:600;color:#374151;background:#f3f4f6;border:1px solid #d1d5db;white-space:nowrap;vertical-align:top;`
	valueCell = `padding:10px 14px;font-size:14px;color:#111827;border:1px solid #d1d5db;`
	monoValue = `padding:10px 14px;font-size:14px;color:#1d4ed8;font-family:Consolas,'Courier New',monospace;font-weight:700;border:1px solid #d1d5db;`
)

// credTable is the login details as a real bordered table (a header row, then label | value rows).
func credTable(rows string) string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 18px 0;border:1px solid #d1d5db;">` +
		`<tr><td colspan="2" style="padding:10px 14px;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:700;border:1px solid #1d4ed8;">Your Login Details</td></tr>` +
		rows + `</table>`
}

func row(label, value, style string) string {
	return fmt.Sprintf(`<tr><td style="%s">%s</td><td style="%s">%s</td></tr>`, labelCell, label, style, value)
}

// loginURL is the sign-in page; empty when APP_BASE_URL is not configured (the line is then left out).
func loginURL(appURL string) string {
	if appURL == "" {
		return ""
	}
	return appURL + "/login"
}

func linkRow(appURL string) string {
	u := loginURL(appURL)
	if u == "" {
		return ""
	}
	return row("Platform link:", fmt.Sprintf(`<a href="%s" style="color:#2563eb;">%s</a>`, esc(u), esc(u)), valueCell)
}

func shell(body string) string {
	return fmt.Sprintf(`<div style="background:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 32px;">
%s
<p style="margin:0;font-size:14px;line-height:1.65;color:#1f2937;">Best Regards,<br>Software Development &amp; Engineering (SDE) Team<br><strong>GLOBX</strong></p>
</div>
<div style="max-width:600px;margin:10px auto 0 auto;font-size:11px;color:#9ca3af;text-align:center;">Automated message from OneTrack v%s. Please do not reply to it.</div>
</div>`, body, version.Current)
}

func para(text string) string { return fmt.Sprintf(`<p style="%s">%s</p>`, pStyle, text) }

// callout is the *Note* block: bold, larger and highlighted, so it is the first thing the reader sees.
func callout(text string) string {
	return fmt.Sprintf(`<p style="margin:0 0 16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;font-size:15px;font-weight:700;line-height:1.55;color:#92400e;">*Note*: %s</p>`, text)
}

// Message returns the subject and HTML body for one mail.
//   - KindInitial: the "Welcome to OneTrack" credentials mail, in the wording the team already uses. It states
//     it.Password; it.Temp changes only the note (an admin set that password, so "already started" does not fit).
//   - KindReset: a short confirmation, no password.
func Message(it Item, appURL string) (subject, body string) {
	username := it.Email // login accepts the email or the username, and the team's mails show the email
	if username == "" {
		username = it.Username
	}
	greet := para("Dear Sir/Madam,") + para("Greetings from the Software Development Team at GLOBX!")

	if it.Kind == KindReset {
		table := row("Username:", esc(username), valueCell) +
			row("Role:", esc(roleList(it.Roles)), valueCell) +
			row("Password:", "The password you set yourself", valueCell) +
			linkRow(appURL)
		return "OneTrack – Please Log In with Your Own Credentials", shell(
			greet +
				para("We are pleased to inform you that you have already reset your password on the OneTrack platform, designed to streamline actions related to Bidding &amp; Tenders. Your login details are below:") +
				credTable(table) +
				callout("Please log in with your own credentials. If you face any issue, kindly contact the Dev Team.") +
				para("We wish you a smooth and productive experience with OneTrack. Should you encounter any issues, please do not hesitate to reach out to the Dev Team for support."))
	}

	note := "If you have already begun using the OneTrack app, kindly disregard this email and continue with your existing credentials."
	if it.Temp {
		note = "Your password was reset by an administrator. If you have already changed it since, kindly disregard this email and continue with your existing credentials."
	}
	table := row("Username:", esc(username), valueCell) +
		row("Role:", esc(roleList(it.Roles)), valueCell) +
		row("Password:", fmt.Sprintf(`%s <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-weight:400;color:#4b5563;">(you will be prompted to change this upon first login*)</span>`, esc(it.Password)), monoValue) +
		linkRow(appURL)
	return "Welcome to OneTrack – Your Login Credentials", shell(
		greet +
			para("We are pleased to welcome you to our new OneTrack platform, designed to streamline actions related to Bidding &amp; Tenders. Please find your login credentials below:") +
			credTable(table) +
			callout(note) +
			para("We wish you a smooth and productive experience with OneTrack. Should you encounter any issues, please do not hesitate to reach out to us for support."))
}

// accessInfoTable renders the "How to access" block — site URL plus the two
// mandatory requirements (in-office + Airtel Wi-Fi).
func accessInfoTable(siteURL string) string {
	safeURL := esc(siteURL)
	linkCell := fmt.Sprintf(`<a href="%s" style="color:#2563eb;font-weight:700;">%s</a>`, safeURL, safeURL)
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 18px 0;border:1px solid #d1d5db;">` +
		`<tr><td colspan="2" style="padding:10px 14px;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:700;border:1px solid #1d4ed8;">Access Information</td></tr>` +
		row("Platform URL:", linkCell, valueCell) +
		row("Network:", "Office Airtel Wi-Fi only", valueCell) +
		row("Location:", "Must be physically present in office", valueCell) +
		`</table>`
}

// stepsBlock renders the numbered how-to-access steps.
func stepsBlock() string {
	const stepStyle = `margin:0 0 8px 0;font-size:14px;line-height:1.65;color:#1f2937;`
	steps := []string{
		"Connect your device to the <strong>office Airtel Wi-Fi</strong> network.",
		"Open any web browser (Chrome, Edge, Firefox) on your device.",
		"Type or click the <strong>Platform URL</strong> shown above in the address bar.",
		"Log in with the username and password that were shared with you separately.",
		"If you see &ldquo;Site cannot be reached&rdquo;, verify you are on the correct Wi-Fi and are inside the office premises.",
		"For any issues, please contact the <strong>Dev Team</strong>.",
	}
	out := `<ol style="margin:0 0 18px 0;padding-left:20px;">`
	for _, s := range steps {
		out += fmt.Sprintf(`<li style="%s">%s</li>`, stepStyle, s)
	}
	return out + `</ol>`
}

// AccessAlertMessage returns the subject and HTML body for an access-information
// mail. It contains NO credentials — only the site URL and how to reach it.
func AccessAlertMessage(siteURL string) (subject, body string) {
	greet := para("Dear Sir/Madam,") +
		para("Greetings from the Software Development Team at GLOBX!")
	intro := para("We would like to inform you that the <strong>OneTrack</strong> platform — our centralised Tender &amp; Bidding Management System — is accessible to you at the URL shown below.")
	warning := callout("⚠️ Important: OneTrack is hosted on an office system and is accessible <strong>only</strong> when you are physically present in the office <strong>and</strong> connected to the office Airtel Wi-Fi. " +
		"The system cannot be accessed remotely, over mobile data, or from outside the office premises.")
	howTo := para("<strong>How to access OneTrack:</strong>") + stepsBlock()
	closing := para("We wish you a smooth and productive experience with OneTrack. Should you encounter any issues, please do not hesitate to reach out to the Dev Team for support.")
	return "OneTrack – How to Access the System", shell(
		greet + intro + accessInfoTable(siteURL) + warning + howTo + closing,
	)
}
