/**
 * routes/notifications-integration.js
 * Notifications pour inscriptions (WhatsApp + Email)
 * Intègre Twilio pour WhatsApp et Nodemailer pour Email
 */

'use strict';

const twilio = require('twilio');
const nodemailer = require('nodemailer');

module.exports = function (pool, opts) {
  const router = require('express').Router();
  
  // Initialiser Twilio
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Initialiser Nodemailer
  const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  /**
   * Envoyer WhatsApp
   */
  async function sendWhatsApp(phoneNumber, message) {
    try {
      if (!phoneNumber) return { success: false, error: 'No phone' };
      const phone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
      
      const result = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155552671',
        to: `whatsapp:${phone}`,
        body: message
      });

      console.log(`[WhatsApp] Envoyé à ${phone}:`, result.sid);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('[WhatsApp error]:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer Email
   */
  async function sendEmail(to, subject, htmlBody, textBody) {
    try {
      if (!to) return { success: false, error: 'No email' };
      
      const result = await emailTransporter.sendMail({
        from: process.env.SMTP_EMAIL || 'noreply@medinimmersion.com',
        to,
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, '')
      });

      console.log(`[Email] Envoyé à ${to}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('[Email error]:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * POST /api/notifications/send-inscription
   * Envoie WhatsApp + Email à un nouvel inscrit
   */
  router.post('/api/notifications/send-inscription', async (req, res) => {
    try {
      const { studentId, firstName, fullName, email, phone } = req.body;

      if (!firstName || !email) {
        return res.status(400).json({ error: 'firstName et email requis' });
      }

      const whatsappMsg = `Assalamu alaikum 👋

Merci ${firstName} ! Votre inscription est confirmée ✅

Un professeur qualifié vous contactera sous 24h pour débuter votre apprentissage.

Bienvenue chez Médin'Immersion 🌙`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2d5a3d; color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 8px; line-height: 1.6; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Assalamu alaikum 👋</h1>
    </div>
    <div class="content">
      <p>Merci <strong>${firstName}</strong> de vous être inscrit(e) à <strong>Médin'Immersion</strong> !</p>
      <p><strong>Votre inscription est confirmée ✅</strong></p>
      <p>Un professeur qualifié et diplômé de l'Université Islamique de Médine vous contactera très bientôt.</p>
      <p style="text-align: center;">
        <a href="https://medinimmersion.com/espace-eleve" style="background: #2d5a3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accéder à votre espace</a>
      </p>
    </div>
    <div class="footer">
      <p>Baraka Allahu fi feeki 💚</p>
      <p><strong>Équipe Médin'Immersion</strong></p>
    </div>
  </div>
</body>
</html>`;

      const results = {
        whatsapp: null,
        email: null
      };

      // Envoyer WhatsApp si numéro fourni
      if (phone) {
        results.whatsapp = await sendWhatsApp(phone, whatsappMsg);
      }

      // Envoyer Email
      if (email) {
        results.email = await sendEmail(
          email,
          '🌙 Bienvenue sur Médin\'Immersion !',
          emailHtml
        );
      }

      // Notifier le gérant
      const gerantEmail = process.env.GERANT_EMAIL || process.env.SMTP_EMAIL;
      if (gerantEmail) {
        const gerantMsg = `Nouvelle inscription : ${fullName} (${email})`;
        await sendEmail(gerantEmail, '🎓 Nouvelle inscription', `<p>${gerantMsg}</p>`);
      }

      res.json({
        success: true,
        message: 'Notifications envoyées',
        results
      });

    } catch (error) {
      console.error('[notifications]', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
