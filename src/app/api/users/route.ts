import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/keycloakAdmin";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const kcAdmin = await authenticateAdmin();
        const users = await kcAdmin.users.find();

        // Transform the user data to match our interface
        const employees = users.map(user => ({
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.attributes?.role?.[0],
        }));

        return NextResponse.json(employees);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
} 