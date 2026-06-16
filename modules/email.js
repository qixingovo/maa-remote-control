const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const smtp = config.smtp;
  if (!smtp || !smtp.host) {
    console.log('[EMAIL] SMTP not configured, email features disabled');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 465,
    secure: true,
    auth: { user: smtp.user, pass: smtp.pass }
  });
  return transporter;
}

async function sendVerifyCode(toEmail, code) {
  const tp = getTransporter();
  if (!tp) throw new Error('邮件服务未配置');
  await tp.sendMail({
    from: `"MAA远程控制" <${config.smtp.user}>`,
    to: toEmail,
    subject: '邮箱验证码 - MAA远程控制',
    text: `您的验证码为：${code}，5分钟内有效。`,
    html: `<p>您的验证码为：<strong style="font-size:24px">${code}</strong></p><p>5分钟内有效。</p>`
  });
}

module.exports = { sendVerifyCode };
