# SMTP setup for POWER LAW Digital

POWER LAW Digital sends email through Nodemailer SMTP. In development, the app prints `[MOCK EMAIL]` when SMTP credentials are missing. In production, the app refuses to boot without real SMTP credentials.

## Required environment variables

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_API_KEY=your-provider-api-key-if-used-as-smtp-password
EMAIL_FROM="POWER LAW Digital <verified-sender@example.invalid>"
EMAIL_FROM_ADDRESS="POWER LAW Digital <verified-sender@example.invalid>"
SMTP_CHECK_TO=your-test-inbox@example.invalid
EMAIL_QUEUE_ENABLED=true
EMAIL_WORKER_ENABLED=true
```

Use either `EMAIL_API_KEY` or `SMTP_PASSWORD` as the SMTP password. If both are set, POWER LAW Digital prefers `EMAIL_API_KEY`.

## SendGrid-style SMTP example

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
EMAIL_API_KEY=SG.your-real-sendgrid-api-key
EMAIL_FROM="POWER LAW Digital <your-verified-sender@example.invalid>"
EMAIL_FROM_ADDRESS="POWER LAW Digital <your-verified-sender@example.invalid>"
SMTP_CHECK_TO=your-personal-inbox@example.invalid
```

The sender address must be verified in the email provider account.

## Local verification

After creating `.env` with real values:

```powershell
npm.cmd install
npm.cmd run email:check
```

Expected result:

```text
SMTP check passed. Message id: ...
```

Then start the full stack:

```powershell
docker compose up --build
```

Trigger one of these flows from the frontend or Postman:

- Register account: sends email verification.
- Forgot password: sends password reset code.
- Submit/assign inquiry: sends business notification emails.

Check queue visibility:

```text
GET /jobs/email
GET /jobs/email/:job_id
```

For final deployment, add the same SMTP variables in DeployRocks/Render environment settings.
