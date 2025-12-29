const nodemailer = require("nodemailer");

const sendEmail = async (userName, email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: "info@pilatesstudioindonesia.com", // Your AUTH email
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
  });

  // Get current date for the header
  const date = new Date().toLocaleDateString("en-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --- HTML EMAIL TEMPLATE ---
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        /* General Resets */
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        
        /* Header */
        .header { background-color: #1B5E20; padding: 20px; color: #ffffff; text-align: left; }
        .header img { max-height: 40px; } 
        .header-date { float: right; font-size: 12px; margin-top: 10px; color: #e0e0e0; }

        /* Body */
        .content { padding: 30px; text-align: center; color: #333333; }
        .greeting { font-size: 18px; margin-bottom: 20px; text-align: left; font-weight: bold; }
        .message { font-size: 14px; margin-bottom: 30px; text-align: center; color: #666; }
        
        /* OTP Box */
        .otp-box { background-color: #f8f9fa; border: 1px dashed #1B5E20; padding: 15px; display: inline-block; border-radius: 5px; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #1B5E20; letter-spacing: 5px; }
        .timer { font-size: 12px; color: #999; margin-top: 5px; }

        /* Footer */
        .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; }
        .footer a { color: #0056b3; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        
        <div class="header">
          <span style="font-size: 24px; font-weight: bold;">Pilates Booking Service</span>
          <span class="header-date">${date}</span>
        </div>

        <div class="content">
          <div class="greeting">Hi ${userName},</div>
          
          <p>Thank you for using Pilates Booking Service.</p>
          
          <div class="message">
            DO NOT GIVE THIS CODE TO ANYONE.<br>
            This is your verification (OTP) code:
          </div>

          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <div class="timer">This code expires in 5 minutes.</div>

          <p style="margin-top: 30px; font-size: 12px; color: #888;">
            This is an automated email. Please do not reply.
          </p>
        </div>

        <div class="footer" style="margin-top: 30px; font-size: 12px; color: #888;">
        © ${new Date().getFullYear()} Pilates Studio Indonesia
        </div>

      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: '"Pilates Studio Indonesia Security" <no-reply@pilatesstudioindonesia.com>',
    to: email,
    subject: "Pilates Studio Indonesia Verification Code",
    html: htmlTemplate, // <--- We use 'html' instead of 'text'
  });
};

module.exports = { sendEmail };
