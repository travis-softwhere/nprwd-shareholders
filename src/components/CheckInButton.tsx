import type React from "react"
import { updateCheckedInStatus } from "../utils/csvParser"

interface CheckInButtonProps {
    userId: string
    isCheckedIn: boolean
    onCheckInChange: (userId: string, isCheckedIn: boolean) => void
}

const CheckInButton: React.FC<CheckInButtonProps> = ({ userId, isCheckedIn, onCheckInChange }) => {
    const handleClick = async () => {
        const newCheckedInStatus = !isCheckedIn
        onCheckInChange(userId, newCheckedInStatus)
        await updateCheckedInStatus(userId, newCheckedInStatus)
    }

    return (
        <button
            onClick={handleClick}
            className={`px-4 py-2 rounded-md ${isCheckedIn ? "bg-green-500 text-white" : "bg-gray-200 text-gray-800"}`}
        >
            {isCheckedIn ? "Check Out" : "Check In"}
        </button>
    )
}

export default CheckInButton