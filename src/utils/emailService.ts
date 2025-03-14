import nodemailer from "nodemailer";
import SMTPConnection from "nodemailer/lib/smtp-connection";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,                   // e.g., smtp.purelymail.com
    port: 465,           // Use EMAIL_PORT, e.g., 587
    secure: true,     // true for port 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
} as nodemailer.TransportOptions);

export async function sendResetEmail(to: string, token: string) {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject: "Set New Password",
        text: `Click the link below to set your new password: ${process.env.FRONTEND_URL}/reset-password?token=${token}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://soft-where.com/wp-content/uploads/2024/03/logo.png" alt="NPRWD Logo" style="max-width: 200px; height: auto;">
                </div>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">Password Reset Request</h2>
                    <p style="color: #34495e; line-height: 1.6; margin-bottom: 20px;">
                        Click the button below to create a new password.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}" 
                           style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 20px;">
                        This link will expire in 2 hours.
                    </p>
                </div>
                <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px;">
                    <p>If you didn't request this password reset, please ignore this email.</p>
                </div>
            </div>
        `,
    };

  

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);
        return info.messageId;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
