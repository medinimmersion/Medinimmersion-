/**
 * routes/notifications-integration.js
 * Notifications pour inscriptions (WhatsApp + Email)
 * Intègre Twilio pour WhatsApp et Nodemailer pour Email
 * Utilise les paramètres sauvegardés du gérant
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
   * Récupère les paramètres de notification du gérant
   */
  async function getGerantNotificationSettings() {
    try {
      const result = await pool.query(`
        SELECT field_key, field_value FROM cms_content 
        WHERE page_key = 'gerant-settings'
        AND field_key IN ('notif_email', 'notif_whatsapp')
      `);

      const settings = {
        email: '',
        whatsapp: ''
      };

      result.rows.forEach(row => {
        if (row.field_key === 'notif_email') settings.email = row.field_value;
        if (row.field_key === 'notif_whatsapp') settings.whatsapp = row.field_value;
      });

      return settings;
    } catch (error) {
      console.error('[getGerantSettings]', error);
      return { email: '', whatsapp: '' };
    }
  }

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
   * Envoie WhatsApp + Email à un nouvel inscrit + notifie le gérant
   */
  router.post('/api/notifications/send-inscription', async (req, res) => {
    try {
      const { studentId, firstName, fullName, email, phone } = req.body;

      if (!firstName || !email) {
        return res.status(400).json({ error: 'firstName et email requis' });
      }

      // Récupérer les paramètres du gérant
      const gerantSettings = await getGerantNotificationSettings();

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
        student: {
          whatsapp: null,
          email: null
        },
        gerant: {
          email: null,
          whatsapp: null
        }
      };

      // === NOTIFICATIONS ÉLÈVE ===
      // Envoyer WhatsApp si numéro fourni
      if (phone) {
        results.student.whatsapp = await sendWhatsApp(phone, whatsappMsg);
      }

      // Envoyer Email
      if (email) {
        results.student.email = await sendEmail(
          email,
          '🌙 Bienvenue sur Médin\'Immersion !',
          emailHtml
        );
      }

      // === NOTIFICATIONS GÉRANT ===
      if (gerantSettings.email) {
        const gerantEmailHtml = `
<html>
<body style="font-family:Arial;color:#333;">
  <h2>🎓 Nouvelle inscription</h2>
  <p><strong>Nom:</strong> ${fullName}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Téléphone:</strong> ${phone || 'Non fourni'}</p>
  <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
  <p><a href="https://medinimmersion.com/admin-gerant.html" style="background:#2d5a3d;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Gérer l'inscription</a></p>
</body>
</html>`;
        
        results.gerant.email = await sendEmail(
          gerantSettings.email,
          `🎓 Nouvelle inscription : ${fullName}`,
          gerantEmailHtml
        );
      }

      if (gerantSettings.whatsapp) {
        const msg = `🎓 Nouvelle inscription!\n\n${fullName}\n${email}\n${phone || ''}\n\nGère-la: medinimmersion.com/admin-gerant`;
        results.gerant.whatsapp = await sendWhatsApp(gerantSettings.whatsapp, msg);
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
