import nodemailer from 'nodemailer';

// Serviço de envio de emails — usa Nodemailer com SMTP configurável via .env
// Para testes locais use: Mailtrap (mailtrap.io) ou Ethereal (nodemailer.com/smtp/ethereal)
// Para produção use: Gmail com App Password, SendGrid, Resend, etc.

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.mailtrap.io',
    port:   Number(process.env.SMTP_PORT)   || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

// Envia o email de redefinição de senha com link seguro
export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  resetToken: string
): Promise<void> {
  const baseUrl   = process.env.FRONTEND_URL || 'http://localhost:5500';
  const resetLink = `${baseUrl}/reset-senha.html?token=${resetToken}`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from:    `"MoneyMind" <${process.env.SMTP_FROM || 'noreply@moneymind.app'}>`,
    to:      toEmail,
    subject: 'Redefinição de Senha — MoneyMind',
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a18;padding:32px 40px;text-align:center;">
              <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Money<span style="color:#1D9E75;">Mind</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="font-size:14px;color:#6b6b67;margin:0 0 8px;">Olá, <strong style="color:#1a1a18;">${userName}</strong></p>
              <h1 style="font-size:22px;color:#1a1a18;margin:0 0 16px;font-weight:700;">Redefinição de senha</h1>
              <p style="font-size:14px;color:#6b6b67;line-height:1.6;margin:0 0 28px;">
                Recebemos uma solicitação para redefinir a senha da sua conta.
                Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.
              </p>

              <div style="text-align:center;margin-bottom:32px;">
                <a href="${resetLink}"
                   style="display:inline-block;background:#1D9E75;color:#ffffff;font-size:15px;font-weight:600;
                          padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
                  Redefinir senha
                </a>
              </div>

              <p style="font-size:12px;color:#a0a09a;line-height:1.5;margin:0;">
                Se você não solicitou a redefinição, ignore este email — sua senha permanece a mesma.<br/>
                Por segurança, nunca compartilhe este link com ninguém.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f4ef;padding:20px 40px;text-align:center;">
              <p style="font-size:11px;color:#a0a09a;margin:0;">
                © ${new Date().getFullYear()} MoneyMind — Controle financeiro inteligente
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
