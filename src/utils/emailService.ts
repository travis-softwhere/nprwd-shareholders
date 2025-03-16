import nodemailer from "nodemailer";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import { safeConsole, logToFile, LogLevel } from "@/utils/logger";

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
    // Default to the development URL if NEXT_PUBLIC_BASE_URL is not set
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    
    // Handle different token formats
    let resetUrl: string;
    let isNewPassword = false;
    
    if (token.startsWith('http')) {
        // Token is already a full URL
        resetUrl = token;
    } else if (token.startsWith('set-new-password:')) {
        // This is a set-new-password token
        isNewPassword = true;
        const actualToken = token.replace('set-new-password:', '');
        resetUrl = `${baseUrl}/set-new-password?token=${actualToken}`;
    } else {
        // Regular reset password token
        resetUrl = `${baseUrl}/reset-password?token=${token}`;
    }
        
    
    // Customize subject and messages based on whether this is a password reset or new account setup
    const subject = isNewPassword ? "Set Your Password" : "Reset Your Password";
    const buttonText = isNewPassword ? "Set Password" : "Reset Password";
    const headingText = isNewPassword ? "Welcome to NPRWD" : "Password Reset Request";
    const bodyText = isNewPassword 
        ? "An account has been created for you. Click the button below to set your password."
        : "Click the button below to create a new password.";
    
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text: `Click the link below to ${isNewPassword ? 'set' : 'reset'} your password: ${resetUrl}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://soft-where.com/wp-content/uploads/2024/03/logo.png" alt="NPRWD Logo" style="max-width: 200px; height: auto;">
                </div>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">${headingText}</h2>
                    <p style="color: #34495e; line-height: 1.6; margin-bottom: 20px;">
                        ${bodyText}
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            ${buttonText}
                        </a>
                    </div>
                    <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 20px;">
                        This link will expire in 2 hours.
                    </p>
                </div>
                <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px;">
                    <p>${isNewPassword ? '' : "If you didn't request this password reset, please ignore this email."}</p>
                </div>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return info.messageId;
    } catch (error) {
        throw error;
    }
}
