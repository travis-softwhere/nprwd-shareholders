import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage shareholders and properties",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {children}
    </>
  );
} 