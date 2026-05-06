export interface Shareholder {
    id: number
    name: string
    shareholderId: string
    /** DB annual-meeting record id this row belongs to */
    meetingId?: string
    ownerMailingAddress?: string;
    ownerCityStateZip?: string;
    /** CSV `shared_id`: merge multiple billing addresses into one mailer when set on import. */
    sharedId?: string;
    totalProperties: number
    checkedInProperties: number
    isNew: boolean
    properties?: Array<{
        id: number;
        account: string;
        serviceAddress?: string;
        customerMailingAddress?: string;
        cityStateZip?: string;
        ownerName?: string;
        ownerMailingAddress?: string;
        ownerCityStateZip?: string;
        residentName?: string;
        residentMailingAddress?: string;
        residentCityStateZip?: string;
        checkedIn: boolean;
    }>;
}

export interface ShareholdersListResponse {
    shareholders: Shareholder[]
    totalShareholders: number
}  