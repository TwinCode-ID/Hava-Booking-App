const sendEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // or your SMTP provider
    auth: {
      user: "your-email@gmail.com",
      pass: "your-email-password",
    },
  });

  await transporter.sendMail({
    from: "MyApp <no-reply@myapp.com>",
    to: email,
    subject: "Your Login OTP",
    text: `Your One-Time Password is: ${otp}. It expires in 5 minutes.`,
  });
};

module.exports = sendEmail;
