export interface Shareholder {
    id: number
    name: string
    shareholderId: string
    ownerMailingAddress?: string;
    ownerCityStateZip?: string;
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